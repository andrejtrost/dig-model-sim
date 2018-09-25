/*File: parsesim.js, language parser and simulator */
/*jshint esversion: 6 */
/*jslint bitwise: true */

const version = "parse v1.2 var2";
const textID = "vhdl";
const MAXITER = 20;
const MAXCYC = 1000;

let vec=new Vector();
//let model = undefined;

function Circuit() {
 let b = new Blok("new");
 let vars = new Map(); 	
 let ports = getPorts();  // read ports from table
 let sequential = false;
 let srcChanged = false;     // input source changed after parsing
 
 function runErr(s) {return "<span style='color: red;'>Runtime Error </span>: "+s;} 
 
 function getVar(id) {
//console.log("Cir.getVar "+id);
	 if (!vars.has(id)) {     // create new var				
		let v = new Var(id);		
		if (ports.has(id)) { // exist in ports
//console.log("exists"+ports.get(id).type.size);
			v.set({type: ports.get(id).type});		//setType old
			v.set({mode: ports.get(id).mode});      //setMode old
		} else {              // set type from global setup
			v.set({type: getDefaultType()});
		}
		vars.set(id, v);
	 }
	 return vars.get(id);
 }

 function setVar(id, value) {
	t = vars.get(id);
	if (t!==undefined) {
       console.log("setVar");		
	   t.val(value);
	}
 }

 function getBlok() {
	 return b;
 }
 
 function setBlok(blok) {  // set block of statements
    b = blok;   
 }
 
 function valDelta(firstCycle) { // evaluate delta cycle
	let change = false;
	if (log) {
		console.log("--- Delta cycle:"+firstCycle);
		vars.forEach(function(v) { 
		  console.log(v.visit()+"="+vec.hex(v.val())); 
		});
        console.log("--- ---- ---");
	}
	
	b.statements.forEach(function(st) {
		if (st.val(firstCycle)) {
			change = true;
			}
	});
	
	let changeNext = false;
	if (change) {		
		vars.forEach(function(v) {
		if (v.next()) {changeNext = true;}
		});
	}
	//console.log("changeNext: "+changeNext);
	
	return changeNext;
 }
 
 function val() {	 // evaluate (simulate) one cycle
	 let iter = 1;
	 let change = valDelta(true);
	 
	 while (change && iter<MAXITER) {
		//if (log) {console.log("--- new cycle");}
		change = valDelta(false);
		iter += 1;
	 }
	 
	 if (iter>=MAXITER) {
		 throw runErr("Simulation infinite loop!");
	 }
 }
 
 function visit(pass) { // visit block, set pass number and give access to vars
	return b.visit(pass, vars);
 }
 
 function push(st) {
	b.push(st);
 }

 function setSeq(b) {
	 sequential = b;
 }
 
 function getSeq() {
	 return sequential;
 }
 
 function changed(b) {
	 if (b!==undefined) {srcChanged = b;}
	 return srcChanged;
 }
 
 return {vars, ports, getVar, setVar, getBlok, setBlok, push, visit, val, setSeq, getSeq, changed}; 
}


function Parse(k) {
    let circ = new Circuit();
	
	function peek() {return k.peek();}  
	function consume() {return k.consume();}
	function parseErr(s) {return "<span style='color: red;'>Parse Error </span>at "+peek().pos()+": "+s;} 
	
	
	function factor(n) { //expect identifier, number or unary
		let t=peek();
		
		if (t.id==="-" || t.id==="~") { // unary 
			consume();
			if (peek().isID()) {				
				let v = circ.getVar(consume().id);
				n.op(t.id);
				n.right(v);
				
				n.set({type: type(v)});
				
				///n.setType(v.getType());				
				return n;
				//return new Op({op:t.id, left:null, right:v});
			}
			if (peek().isNum()) {
				v = new NumConst("-"+consume().id);
				n.op(t.id);
				n.right(v);
				n.set({type: type(v)});
				///n.setType(v.getType());				
				return n;				
				
				//return new NumConst("-"+consume().id);
				
			}
			throw parseErr("Expected identifier or number after unary operator!");
		}
		else if (t.isID()) { // save variable & set op type
			let v = circ.getVar(consume().id); 
			n.left(v);
			n.set({type: type(v)});
			///n.setType(v.getType());
			return n;
			//console.log("Varname: "+varname);
			//return circ.getVar(consume().id);
		}
		else if (t.isNum()) { 
			let num = new NumConst(consume().id); 
			n.left(num); 			
			n.set({type: type(num)});
			return n;
		    //return new NumConst(consume().id); 
		}
		else if (t.id === "(") {
			consume();
			let e = expression(n);
			if (peek().id===")") { consume(); }
			else { 
			  throw parseErr("Expected )!"); 
			}
			return e;					
		} else { throw parseErr("Expected identifier or number! ("+t.id+")"); }
	}
	
	function term(n) {  // test the operation !
		let f = factor(n);
		if (f === undefined) {return;}
		
		/*let y = new Op({op:"", left:f, right:null});
		y.setType(f.getType());*/
						
		while (peek().id==="*" || peek().id==="&") {
			let o = consume().id;
			
			if (f.getOp()==="") { // set empty or create new
				f.op(o);				
			} else {
				f = new Op({op:o, left:f, right:null});
			}			
				
			// second factor
			let f2 = factor(new Op({op:"", left:null, right:null})); 
			f.right(f2);
			let sz = Math.max(type(f).size, type(f2).size);
			let u = type(f).unsigned && type(f).unsigned;
			f.set({type: {unsigned: u, size: sz}});	
				
			console.log("Term type: "+u+" "+sz);			
		}
		
		return f; //y
	}
	
	
	function expression(n) {
		let x = term(n);
		if (x === undefined) {return;}
		//console.log("term type: "+x.getType().size);
		
		while (peek().id==="+" || peek().id==="-" || peek().id==="|" || peek().id==="^") {
			let o = consume().id;
			
			if (x.getOp()==="") { // set empty or create new operation
				x.op(o);
			} else {
				//console.log(type(x));
				x = new Op({op:o, left:x, right:null}, type(x));				
			}
			
			// second term
			let x2 = term(new Op({op:"", left:null, right:null}));
			x.right(x2);
			
			
			let sz = Math.max(type(x).size, type(x2).size);			
			console.log("Sum  "+sz);
			if (o==="+" || o==="-") {sz += 1;}			
			let u = type(x).unsigned && type(x2).unsigned;
			x.set({type: {unsigned: u, size: sz}});	
				
			console.log("Sum type: "+u+" "+sz);		
		}
		
		let logstr = x.visit(true);   // visit operator for statistics
		if (log) {console.log(logstr);}  
		return x;
	}
	
	function assignment(id, op, pos) // beri in kodiraj prireditev
	{
		let a = new Statement(op); // define assignment statement		
		a.set({pos: pos});
		
		
		a.set({level: Number(circ.getBlok().get().level)});	
//console.log("ASSIGN "+id+" level:"+Number(circ.getBlok().get().level));		
		let v = circ.getVar(id);   // get output var
		
		if (mode(v)==="in") {
			throw parseErr("Error: Assignment target: '"+id+"' is input signal!");
		}
		
		
		a.setTarget(v);		
		
		// opnode
		let node = new Op({op:"", left:null, right:null});
		
		node = expression(node);

		if (node === undefined) {return;}
		a.setExpr(node);
		
		return a;
	}
	
	function takeToken(id) {	
		if (peek().id === id) {consume();}
		else {
			throw parseErr("Unexpected: "+peek().id+", expected: '"+id+"'!");
		}

	}
	
	function comparison(n) {		
		let e = expression(n);
//console.log("parse:com: "+e.visit(true)+" Ctype: "+typeToString(type(e)));	
		if (e === undefined) {return;}
		
		if (isComparisonOp(peek().id)) {
			let o = consume().id;
			if (e.getOp()==="") { // prazna operacija
				e.op(o);
			} else {
				e = new Op({op:o, left:e, right:null});
			}			
							
			let e2= expression(new Op({op:"", left:null, right:null}));

			e.right(e2);
			
		    // check if compare sig of same type or sig & num
			
			let sz = Math.max(type(e).size, type(e2).size);
			let u = type(e).unsigned && type(e2).unsigned;
			e.set({type: {unsigned: u, size: sz}});

		} else { // add required operator (value != 0)
			let o = "!=";
			if (e.getOp()==="") { // prazna operacija
				e.op(o);
			} else {
				e = new Op({op:o, left:e, right:null}, type(e)); // TODO: check
			}										
			e.right(new NumConst(0));		
		}
		
		let logstr = e.visit(true);   // visit operator for statistics
		return e;
	}
	
	function boolop(n) {
		let c = comparison(n);
		
		while (peek().id==="&&" || peek().id==="||") { 
		    console.log("AND-OR");
			let o = consume().id;
			
			if (c.getOp()==="") { 
				c.op(o);				
			} else {
				c = new Op({op:o, left:c, right:null});
			}
			
			let c2 = comparison(new Op({op:"", left:null, right:null}));
			c.right(c2);
			
			let sz = Math.max(type(c).size, type(c2).size);
			let u = type(c).unsigned && type(c2).unsigned;
			c.set({type: {unsigned: u, size: sz}});	
		}	
		
		return c;
	}
	
	function condition() {
	 let n = new Op({op:"", left:null, right:null});
	 n = boolop(n);

console.log("parse:condition type: "+typeToString(type(n)));
	 return n;
	}
	
	function skipSeparators() {
		while (peek().isSeparator()) {consume();}
	}
	
	function parseIf()
	{		
		let ifst = new Statement("if");
		ifst.set({level: Number(circ.getBlok().get().level)});	
		
		let ifblok = new Blok("if");		
		let elseBlok = null;
		
		takeToken("(");		
		let c = condition(); 
		ifst.setExpr(c);		
		takeToken(")");
		
		let saveBlok = circ.getBlok();
		let level = saveBlok.get().level;
		ifblok.set({level: (Number(level)+1)}); // set new block level a.set({level: level});
		
		circ.setBlok(ifblok);		
		parseBlock(ifblok);
		
		skipSeparators();		
		if (peek().id==="else") {
			consume();
			elseBlok = new Blok("else");
			elseBlok.set({level: (Number(level)+1)});
			circ.setBlok(elseBlok);			
			parseBlock(elseBlok);
		}
		
		ifst.setIf(ifblok, elseBlok);
		circ.setBlok(saveBlok);
				
		return ifst;
	}	
	
	function parseStatement() // parse & return known statement or null
	{		
		let statement = null;
		
		skipSeparators();		
		let t = peek();
		
		if (t.isID()) { // identifier
		  let pos = t.pos();
		  let id = consume().id;
		  
		  if (peek().isAssign()) {  // expect assignment
		    
			let op = consume().id;
			statement = assignment(id, op, pos); // return statement or undefined
						
			if (op==="<=") {circ.setSeq(true);}
		  } else { 
			throw parseErr("Unexpected token: '"+peek().id+"'!");
		  }		  
		} else if (t.id==="if") { 
			consume();			
			statement = parseIf(); // return statement or undefined 
		} else if (t.id==="{") {
			throw parseErr("Misplaced {!");			
		} else if (t.id==="}") {   // return witout parsing
		} else {
			if (!t.isEOF()) { throw parseErr("Unexpected token: '"+t.id+"'!"); }
		}
      
		return statement;		
	}
	
	function parseBlock(c) {
		let t = peek();
		let statement = null;
				
		while (t.isSeparator()) { consume(); t=peek();}
		takeToken("{");				
		do {
			statement = parseStatement();
			if (statement!==null) {
				c.push(statement);
			}
			t = peek();	
			if (t.isEOF()) {break;}
		} while (t.id!=="}");  // isEnd > isEOF	
		
		takeToken("}");
	}
	
  try {	  
	  clearLog();
	  stat.init();
	  
	  let t = peek();
	 	
	  parseBlock(circ);
	  t = peek();
	  if (!(peek().isEOF())) {
		setLog(parseErr("Unexpected code after block end!"));
		//console.log(t.pos()+" Unexpected circ after block end! "+peek().id);
	  }
	  	  
	  let logStr=circ.visit(1); // visit, first pass
	  
	  stat.getSet(Resource.FF).forEach(function(id) {  // calculate number of FFs
	      stat.incNum(type(circ.getVar(id)).size, Resource.FF);
	  });
	  
	  // check ports usage, note: in used as out checked at assignment visit,
	  //   out used as inout solved at 2nd pass visit
	  circ.ports.forEach(function (val, id) { 
		var v = circ.getVar(id);
		var mod = mode(v);
		if (mod==="out" && hdl(v).mode==="in") {  // wrong declaration or usage
			setLog(formatErr("Variable: "+id+" should be declared as input!"));
		}
	  });
	  
	  // vars check and I/O resource usage
	  circ.vars.forEach(function (val, id) {
		var mod = mode(val); //val.getMode();
		var mod1 = hdl(val).mode;
		if (mod1===undefined) {mod1 = "";}
		if (mod==="") { // test internal signals			
			if (mod1==="" || mod1==="out") {
				// TODO: remove
				setLog("Note: unused variable: "+id);
			}
			if (mod1==="in") {
				setLog("Note: variable: "+id+" should be declared as input!");
			}
			
		}		
		if (mod==="in" || mod==="out") {
			stat.incNum(type(val).size, Resource.IO);
		}
		if (hdl(val).assignments>1) {
			stat.incNum(1, Resource.MUX);
		}
		
	  });
	  
	  setStat(stat.emit());	  
	  
	  if (log) {
		console.log(logStr);  // log parsed tree and signals
		console.log("Sequential: "+circ.getSeq());
		console.log("Signals: ");
		circ.vars.forEach(function(v) {
			//v.setName(v.get().name+"1");  TODO preimenuj
			
			console.log(v.visit()+" "+type(v).id+" val="+vec.out(v.val(), type(v).unsigned)+" mode="+mode(v)+" type="+typeToString(type(v))+
			" "+type(v).id+" hdl="+hdl(v).mode+" ");
		});
	  }	  
	  setLog("Parse finished.");
	  parseButton(1);	  
	  model = circ; // set circuit model
	  
	  
  } catch(er) {
	  setLog(er);
	  console.log("Error: "+er);
	  model = undefined;
  }  
}

function runCycle(tree, i) {
  try {
	console.log("Run cycle "+i);
	
	let s = getInValues(i);//getSignals(i);
	if (s===undefined) {
		console.log("Run cycle: End.");
		return false;
	}
	
	s.forEach(function (val, id) {		
		let v = tree.getVar(id);
		v.setVal(vec.parse(val));
	});
	
	tree.val();
	tree.ports.forEach(function (p, id) {
		if (tree.vars.has(id)) {
			if (p.mode==="out") {
			  console.log("Port out: "+id);
			  v= tree.vars.get(id);			  
			  setSignal(i, id, vec.out(v.val(), type(v).unsigned));
			}
			
		}
	});
	
	console.log("End");
	return true;
  } catch(ex) {
	setLog(ex);
	console.log("Runtime: "+ex);  
  }
}

function run()
{
  let d = 0;
  let res = false;
  
  if (model===undefined) {return;}
  //else {console.log(tree);}
  setLog("Run...");  
  
  if (model) {res = runCycle(model, d);}
  while (res===true && d<MAXCYC) {
	d += 1;
    res = runCycle(model, d);
  }
  setLog("End.");
}
