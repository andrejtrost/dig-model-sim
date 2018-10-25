/*File: parsesim.js, language parser and simulator */
/*jshint esversion: 6 */
/*jslint bitwise: true */

const version = "V.17a";
const textID = "vhdl";
const MAXITER = 20;
const MAXCYC = 1000;

let globPrevStatement="";

let vec=new Vector();
//let model = undefined;

function Circuit() {
 let b = new Blok("new");
 let vars = new Map(); 
 let ports = getPorts();
 let sequential = false;
 let srcChanged = false;     // input source changed after parsing
 
 function runErr(str) {
	const er = (english) ? "Runtime Error: " : "Napaka izvajanja: ";
	return "<span style='color: red;'>"+er+"</span>"+errTxt(str);
 } 
 
 function getVar(id) {  // get or create new Var 
//console.log("Cir.getVar "+id);
	 if (!vars.has(id)) {			
		let v = new Var(id);		
		if (ports.has(id)) { // get type & mode from ports
			v.set({type: ports.get(id).type});
			v.set({mode: ports.get(id).mode});
		} else {             // ...or from global setup
			v.set({type: getDefaultType()});
		}
		vars.set(id, v);
	 }
	 return vars.get(id);
 }

 function setVar(id, value) { // Todo: remove ?
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
 
 function valDelta(firstCycle, i) { // evaluate delta cycle
	let change = false;
	if (log) {
		console.log("--- Delta cycle:"+firstCycle);
		vars.forEach(function(v) { 
		  console.log(v.visit()+"="+vec.hex(v.val())); 
		});
        console.log("--- ---- ---");
	}
	
	b.statements.forEach(function(st) {
		if (st.val(firstCycle, i)) {
			change = true;
			}
	});
	
	let changeNext = false;
	if (change) {		
		vars.forEach(function(v) {
		if (v.next()) {changeNext = true;}
		});
	}
	
	return changeNext;
 }
 
 function val(i) {	 // evaluate (simulate) one cycle
	let iter = 1;
	let change = true;
	
	let s = getInValues(i-1);  // read input(i-1)
	if (s===undefined) {return;}
	
	s.forEach(function (val, id) {
		y= vec.parse(val);
//console.log("GETIN "+id+"="+val+" "+y[1]+","+y[0]);		
		let v = getVar(id);
		v.setVal(vec.parse(val));
	});	 
	
	change = valDelta(true, i);
	
	s = getInValues(i);  // read input (i)
	if (s===undefined) {return;}
	
	s.forEach(function (val, id) {		
		v = getVar(id);
		v.setVal(vec.parse(val));
	});	
	
	change = valDelta(false, i); // second delta, combinational
	
	 while (change && iter<MAXITER) {
		change = valDelta(false, i);
		iter += 1;
	 }
	 
	 if (iter>=MAXITER) {
		 throw runErr("inf");
	 }
	 
	return true;
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
    let circ = undefined;
	
	function peek() {return k.peek();}  
	function consume() {return k.consume();}
	function parseErr(str, id) {
		const er = (english) ? "Parse Error " : "Napaka ";
		const er1 = (english) ? "at " : "v ";
		return "<span style='color: red;'>"+er+"</span>"+er1+peek().pos()+": "+errTxt(str, id);
	} 	
	
	function primary(n) { // primary :== name | literal | ( expression )
		let t=peek();
		
		if (t.isID()) { // identifier, save variable & set op type
			let v = circ.getVar(consume().id); 
			n.left(v);
			n.set({type: type(v)});
			return n;
		}
		else if (t.isNum()) { // number
			let token = consume();
			let num = new NumConst(token.id, token.format()); 
			n.left(num); 			
			n.set({type: type(num)});
			return n;
		}
		else if (t.id === "(") { // braces with new expression
			consume();
			let e = expression(n); 
			if (peek().id===")") { consume(); }
			else { 
			  throw parseErr("exp",")"); // Expected ) 
			}
			return e;					
		} else { 
			throw parseErr("expvn"); //Expected identifier or number
		}
	}
	
	function factor(x) { // factor :== primary | - primary | NOT primary
		let t=peek();		
		
		if (t.id==="-" || t.id==="~") { // unary operator
			let o = consume().id;
			// set empty or create new Op
			if (x.getOp()==="") {x.op(o);} 
			else {x = new Op({op:o, left:x, right:null});}			
			
			let x2 = primary(new Op({op:"", left:null, right:null}));
			x.right(x2);
			let u2 = type(x2).unsigned
			let sz = type(x2).size;
			x.set({type: {unsigned: u2, size: sz}});
		} else {
			x = primary(x);
		}
			
		return x;
	}
	
	function term(n) {  // term :== factor {* factor}
		let f = factor(n);
		if (f === undefined) {return;}
						
		while (peek().id==="*") {
			let o = consume().id;
			
			if (f.getOp()==="") { // set empty or create new
				f.op(o);				
			} else {
				f = new Op({op:o, left:f, right:null});
			}			
				
			// second factor
			let f2 = factor(new Op({op:"", left:null, right:null})); 
			f.right(f2);
			
			const sz1 = type(f).size;
			const sz2 = type(f2).size;
			let sz = sz1 + sz2;  // product size

			if (sz1===1 && sz2===1) { // for 1 bit change to AND
				f.op("&");
				sz = 1; 
			}
			
			let u1 = type(f).unsigned;
			let u2 = type(f2).unsigned;
			
			if (!u1 && u2) { // signed & unsigned number > signed
				if (type(f2).id==="num") {
					f2.set({type: {unsigned: false}});
					u2 = false;
				}
			} else if (u1 && !u2) { // unsigned num & signed > signed num
				if (type(f).id==="num") {
					f.set({type: {unsigned: false}});
					u1 = false;
				}				
			}
			
			if ((u1 && !u2) || (!u1 && u2)) {
				throw parseErr("mixs");
			}			
			
			f.set({type: {unsigned: u1 && u2, size: sz}});					
			console.log("Term type: "+(u1 && u2)+" "+sz);			
		}
		
		return f;
	}

	function shift(n) {  // shift :== term {+,- term}
		let x = term(n);
		if (x === undefined) {return;}
						
		while (peek().id==="+" || peek().id==="-" || peek().id===",") {
			let o = consume().id;
			// set empty or create new Op
			if (x.getOp()==="") {x.op(o);} 
			else {x = new Op({op:o, left:x, right:null});}			
				
			// second relation
			let x2 = term(new Op({op:"", left:null, right:null})); 
			x.right(x2);
			
			const sz1 = type(x).size;
			const sz2 = type(x2).size;
			let sz = Math.max(sz1, sz2)+1;  // allow carry
			if (o===",") {sz = sz1+sz2;}
			
			let u1 = type(x).unsigned;
			let u2 = type(x2).unsigned;
			
			if (!u1 && u2) { // signed & unsigned number > signed
				if (type(x2).id==="num") {
					x2.set({type: {unsigned: false}});
					u2 = false;
				}
			} else if (u1 && !u2) { // unsigned num & signed > signed num
				if (type(x).id==="num") {
					x.set({type: {unsigned: false}});
					u1 = false;
				}				
			}
			
			if ((u1 && !u2) || (!u1 && u2)) {throw parseErr("mixs");}			
			
			x.set({type: {unsigned: u1 && u2, size: sz}});		
//console.log("relation type: "+(u1 && u2)+" "+sz);
		}
		
		return x;
	}	
	
	function relationAND(n) {  // relation :== shift [<<, >> literal]
		let x = shift(n);
		if (x === undefined) {return;}
						
		if (peek().id==="<<") {  // currently only <<
			let o = consume().id;
				
			// second operand (fixed number)
			let t=peek();
			
			if (t.isNum()) { // number
				let token = consume();
				let num = Number(token.id); //new NumConst(token.id, token.format()); 
				
				const sz = type(x).size;
				
				if (num<1 || num+sz>64) {throw parseErr("sizeov");} //Size overflow
				
				console.log("<< "+num); //OK, <<, concat with padding zeros
				
				let pad = new NumConst("0", "b"+num);
				x.right(pad);
				
				if (x.getOp()==="") {x.op(",");} 
				else {x = new Op({op:"'", left:x, right:null});}
												
				let u1 = type(x).unsigned;			
				x.set({type: {unsigned: u1, size: (sz+num)}});
			
				
			} else {
				throw parseErr("explit"); //Expected numeric literal
			}
		}
		
		return x;
	}
	
	function relation(n) {  // relation :== relationAND { AND relationAND }
		let x = relationAND(n);
		if (x === undefined) {return;}
						
		while (peek().id==="&") {
			let o = consume().id;
			// set empty or create new Op
			if (x.getOp()==="") {x.op(o);} 
			else {x = new Op({op:o, left:x, right:null});}			
				
			// second relation
			let x2 = relationAND(new Op({op:"", left:null, right:null})); 
			x.right(x2);
			
			const sz1 = type(x).size;
			const sz2 = type(x2).size;
			let sz = Math.max(sz1, sz2);			
			let u1 = type(x).unsigned;
			let u2 = type(x2).unsigned;
			
			if (!u1 && u2) { // signed & unsigned number > signed
				if (type(x2).id==="num") {
					x2.set({type: {unsigned: false}});
					u2 = false;
				}
			} else if (u1 && !u2) { // unsigned num & signed > signed num
				if (type(x).id==="num") {
					x.set({type: {unsigned: false}});
					u1 = false;
				}				
			}
			
			if ((u1 && !u2) || (!u1 && u2)) {throw parseErr("mixs");}			
			
			x.set({type: {unsigned: u1 && u2, size: sz}});		
//console.log("relationA type: "+(u1 && u2)+" "+sz);
		}
		
		return x;
	}
	
	
	function expression(n) {  // expression :== relation { OR,XOR relation}
		let x = relation(n);
		let o = "?";
		if (x === undefined) {return;}
		
		while (peek().id==="|" || peek().id==="^") { 
			o = consume().id;
			
			if (x.getOp()==="") { // set empty or create new operation
				x.op(o);
			} else {
				const opType={...type(x)};   //copy type property
				x = new Op({op:o, left:x, right:null}, opType); // type(x)
			}
			
			// second relationA
			let x2 = relation(new Op({op:"", left:null, right:null}));
			x.right(x2);
						
			let sz = Math.max(type(x).size, type(x2).size);			
			
			let u1 = type(x).unsigned;
			let u2 = type(x2).unsigned;
			if (!u1 && u2) { // signed & unsigned number > signed
				if (type(x2).id==="num") {
					x2.set({type: {unsigned: false}});
					u2 = false;
				}
			} else if (u1 && !u2) { // unsigned num & signed > signed num
				if (type(x).id==="num") {
					x.set({type: {unsigned: false}});
					u1 = false;
				}				
			}
			
			if ((u1 && !u2) || (!u1 && u2)) {
				throw parseErr("mixs");
			}
			x.set({type: {unsigned: u1 && u2, size: sz}});
		}
		
		let logstr = x.visit(true);   // visit operator for statistics
		if (log) {console.log(logstr);}
//console.log("Exp: "+ typeToString(type(x)));		
		return x;
	}
	
	function exprList(n) {
		let x = expression(n);
		let o = "?";
		if (x === undefined) {return;}
		//console.log("term type: "+x.getType().size);
		
		while (peek().id===",") { // expression list, concatenation operator
			o = consume().id;
			
			if (x.getOp()==="") { // set empty or create new operation
				x.op(o);
			} else {
				const opType={...type(x)};   //copy type property
				x = new Op({op:o, left:x, right:null}, opType); // type(x)
			}
			
			// second term
			let x2 = term(new Op({op:"", left:null, right:null}));
			x.right(x2);

			let sz = type(x).size + type(x2).size;
			if (sz>64) {throw parseErr("limit");}
			
			const u1 = type(x).unsigned;
			const u2 = type(x2).unsigned;
			/*if ((u1 && !u2) || (!u1 && u2)) {
				throw parseErr("mixs");        // TODO: maybe no error?
			}*/
			// set operator sign of the left
			x.set({type: {unsigned: u1, size: sz}});
		}
		return x;
	}	
	
	function parseAssign(v, op, pos) // assignment expression (take var v)
	{
		let a = new Statement(op);  // statement, define target, position and level
		a.setTarget(v);
		
		a.set({pos: pos});				
		a.set({level: Number(circ.getBlok().get().level)});		
		stat.setPos(pos);
		
		// opnode
		let node = new Op({op:"", left:null, right:null});		
		node = exprList(node);
		
		if (node === undefined) {return;}
		a.setExpr(node);
		
		if (node.count()===1 && type(node).id==="num") {  // single value assigment
			if (type(node).format[0]==="b") {             // binary format		
				let t = {...type(v)};  // type: unsigned, size of binary
				t.unsigned = true;
				t.size = Number(type(node).format.slice(1));
				t.def = false;
				if (type(v).def) {    // redefine default data type (not from ports)
					v.set({type: t});
				} else {              // check data type
				   if (type(v).unsigned===false || type(v).size!==t.size) {
					   setLog("Warning: "+pos+" binary assignment size difference");
				   }
				
				}
			}
			
		}
		
		globPrevStatement="a";
		return a;
	}
	
	function takeToken(id) {	
		if (peek().id === id) {consume();}
		else {
			throw parseErr("exp",id);
		}

	}
	
	function comparison(n) {		
		let e = expression(n);
//console.log("parse:com: "+e.visit(true)+" Ctype: "+typeToString(type(e)));	
		if (e === undefined) {return;}
		
		//let isVar = false;
		if (isComparisonOp(peek().id)) {
			let o = consume().id;
			if (e.getOp()==="") { // prazna operacija
				e.op(o);
				// check for id ==
				//if (o==="==" ) {
				//	if (e.getLeft().get().isVar) {isVar = true;}
				//}
			
			} else {
				const opType={...type(e)};
				e = new Op({op:o, left:e, right:null}, opType);
			}			
							
			let e2= expression(new Op({op:"", left:null, right:null}));

			e.right(e2);
			//if (isVar && type(e2).id==="num") {
//console.log("FOUND id==num!!");
			//}
			
		    // check if compare sig of same type or sig & num
			
			let sz = Math.max(type(e).size, type(e2).size);
			let u = type(e).unsigned && type(e2).unsigned;
console.log("**** Cmp:"+o+" size: "+type(e).size+", "+type(e2).size);			
			e.set({type: {unsigned: u, size: sz}});
			
		} else { // add required operator (value != 0)			
			let o = "!=";
			let rightObj = new NumConst(0); 
			
			if (type(e).size===1) { // ==1, if expression is one bit
				o = "==";
				rightObj = new NumConst(1);
			} 
			if (e.getOp()==="") { // prazna operacija
				e.op(o);
			} else {
				e = new Op({op:o, left:e, right:null}, type(e)); // TODO: check
			}										
			e.right(rightObj);
		}
		
		let logstr = e.visit(true);   // visit operator for statistics
		return e;
	}
	
	function booland(n) {
		let c = comparison(n);
		
		while (peek().id==="&&") { 
		    console.log("AND");
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
	
	function boolop(n) {
		let c = booland(n);
		
		while (peek().id==="||") { 
		    console.log("OR");
			let o = consume().id;
			
			if (c.getOp()==="") { 
				c.op(o);				
			} else {
				c = new Op({op:o, left:c, right:null});
			}
			
			let c2 = booland(new Op({op:"", left:null, right:null}));
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
	
	function parseIf(pos, oneStatement) //******** IF ***********
	{		
console.log("IF onestatement:"+oneStatement+" prev:"+globPrevStatement);	
		let ifst = new Statement("if");
		ifst.set({level: Number(circ.getBlok().get().level)});
		ifst.set({pos: pos});
		stat.setPos(pos);
		
		let ifblok = new Blok("if");		
		let elseBlok = null;
		
		takeToken("(");		
		let c = condition(); 
		ifst.setExpr(c);		
		takeToken(")");
		
		let elsif = (oneStatement && globPrevStatement==="else") ? true : false;
		
		globPrevStatement="if";
		
		let saveBlok = circ.getBlok();
		let level = saveBlok.get().level;
		// if following else > elseif
		if (elsif) {
			ifst.set({level: (Number(level)-1)}); // Reverse level...
			ifst.set({elsif: 1});
			ifblok.set({level: (Number(level))});
		}
		else {
			ifblok.set({level: (Number(level)+1)}); 
		}
		
		circ.setBlok(ifblok);

		let n = peek().id;	
		if (n==="\n" || n==="{") {	// new line or {, expect new block
			parseBlock(ifblok, false);
		} else {
			parseBlock(ifblok, true); // one statement block
		}
		
		skipSeparators();		
		if (peek().id==="else") {
			consume();
			elseBlok = new Blok("else");

            globPrevStatement="else";
			if (elsif) {
				elseBlok.set({level: (Number(level))}); 
			} else { 			
				elseBlok.set({level: (Number(level)+1)}); 
			}
			circ.setBlok(elseBlok);	
			n = peek().id;
			if (n==="\n" || n==="{") {				
				parseBlock(elseBlok, false);
			} else {  
				parseBlock(elseBlok, true);  // one statement block				
			}			
		}
		
		ifst.setIf(ifblok, elseBlok);
		circ.setBlok(saveBlok);
				
		return ifst;
	}	
	
	function parseStatement(oneStatement) // parse & return known statement or null
	{		
		let statement = null;
		
		skipSeparators();		
		let t = peek();
		
		if (t.isID()) { // identifier
		  let pos = t.pos();
		  let id = peek().id;
		  
		  let v = circ.getVar(id);   // get output var		
			if (mode(v)==="in") {
				throw parseErr("tin", id); //Assignment target: '"+id+"' is input signal!");
			}			  
		  consume();
		  
		  if (peek().isAssign()) {  // expect assignment		  
			let op = consume().id;
			statement = parseAssign(v, op, pos); // return statement or undefined
						
			if (op==="<=") {circ.setSeq(true);}
			
		  } else { 
			throw parseErr("exp", "=");  //"Unexpected token: '"+peek().id+"'!"
		  }		  
		} else if (t.id==="if") {
			let pos = t.pos();			
			consume();			
			statement = parseIf(pos, oneStatement); // return statement or undefined 
		} else if (t.id==="{") {
			throw parseErr("unexp", "{");			
		} else if (t.id==="}") {   // return witout parsing
		} else {
			if (!t.isEOF()) { throw parseErr("unexp", t.id); }//parseErr("Unexpected token: '"+t.id+"'!"); }
		}
      
		return statement;		
	}
	
	function parseBlock(c, oneStatement) {    // c = Blok(), oneStatement: bool
		let t = peek();
		let statement = null;
		
		if (oneStatement) { // parse one statement Block (eg. if (c) St)
			statement = parseStatement(oneStatement);			
			//statement.set({single: 1});
			if (statement!==null) {
				c.push(statement);
			}
		} else {
			while (t.isSeparator()) { consume(); t=peek();}
			takeToken("{");				
			do {
				statement = parseStatement(oneStatement);
				if (statement!==null) {
					c.push(statement);
				}
				t = peek();	
				if (t.isEOF()) {break;}
			} while (t.id!=="}");  // isEnd > isEOF	
			
			takeToken("}");
		}
	}
	
  try {	  
	  clearLog();
	  circ = new Circuit();
	  stat.init();
	  
	  let t = peek();
	 	
	  parseBlock(circ);
	  t = peek();
	  if (!(peek().isEOF())) {
		setLog(parseErr("Misplaced end of code block \"}\""));
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
		    throw modelErr("vin", id); // Signal should be declared as input
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
		let sigmode = "";
		let as = "";
		console.log(logStr);  // log parsed tree and signals
		//logStr = circ.visit(2); // ********** še enkrat
		//console.log(logStr);
		
		console.log("Sequential: "+circ.getSeq());
		console.log("Signals: ");
		circ.vars.forEach(function(v) {
			sigmode = ",";
			if (hdl(v).mode!==undefined) sigmode=","+hdl(v).mode;
			as = ",";
			if (hdl(v).assignop!==undefined) as=","+hdl(v).assignop+hdl(v).assignments;
			console.log(v.visit()+":"+type(v).id+" "+ //" val="+vec.out(v.val(), type(v).unsigned)+" mode="+mode(v)+" type="+
			typeToString(type(v))+sigmode+as);
			//" "+type(v).id+" hdl="+hdl(v).mode+" ");
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
	
	let result = tree.val(i); // simulate, cycle: i
	if (result===undefined) {
		console.log("Run cycle: End.");
		return false;
	}
	
	tree.ports.forEach(function (p, id) {
		if (tree.vars.has(id)) {
			if (p.mode==="out" || p.mode==="") {
			  //console.log("Port out: "+id);
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
  if (model.changed()) {parseCode();}
  
  //else {console.log(tree);}
  setLog("Run...");  
  
  if (model) {res = runCycle(model, d);}
  while (res===true && d<MAXCYC) {
	d += 1;
    res = runCycle(model, d);
  }
  setLog("End.");
}
