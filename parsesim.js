/*File: parsesim.js, language parser and simulator */
/*jshint esversion: 6 */
/*jslint bitwise: true */

const parseVersion = "V.26";
const textID = "src";
const MAXITER = 20;
const MAXCYC = 1000;

let globPrevStatement="";
let globAssignSize=0; //29.3.

let vec=new Vector();
let model = undefined;

function Circuit() {
 let b = new Blok("1");
 let vars = new Map(); 
 let ports = getPorts();
 let sequential = false;
 let srcChanged = false;     // input source changed after parsing
 
 function runErr(str) {
	const er = (english) ? "Runtime Error: " : "Napaka izvajanja: ";
	return "<span style='color: red;'>"+er+"</span>"+errTxt(str);
 } 

 function idErr(str, id) {
	const er = (english) ? "Error: " : "Napaka: ";
	return "<span style='color: red;'>"+er+"</span>"+errTxt(str, id);
 } 
 
 function setPorts(id, obj) {
	 ports.set(id, obj);
 }
 
 function getVar(id, returnNull) {  // get or create new, if not returnNull
     //console.log("Cir.getVar "+id);
	 const sId = id.toLowerCase();
	 
	 if (!vars.has(id)) {
		if (returnNull) {return null;}  // if not found, return null
		if (VHDLrsv.indexOf(sId)>=0) { throw idErr("rsv",id); } // is VHDL keyword?
	
        // check if exists the same name with different case	 
	    var ids = Array.from( vars.keys() ).map(v => v.toLowerCase());	
		// exists if compare small letters, mixed case error
		if (ids.indexOf(sId)>=0) { throw idErr("mixc",id); } 
		
		let v = new Var(id);		
		if (ports.has(id)) { // get type & mode from ports
			if (ports.get(id).init!==undefined) {			
				v.set({init: ports.get(id).init});
			}			
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
 
 return {vars, ports, setPorts, getVar, setVar, getBlok, setBlok, push, visit, val, setSeq, getSeq, changed}; 
}


function Parse(k) {
    let circ = undefined;
	
	function peek() {return k.peek();}  
	function consume() {return k.consume();}
	function parseErr(str, id) {
		const er = (english) ? "Parse Error " : "Napaka ";
		const er1 = (english) ? "at " : "v ";
		const line = Number(peek().pos().substr(0, peek().pos().indexOf(':')));
		selectLine(line);
		
		return "<span style='color: red;'>"+er+"</span>"+er1+peek().pos()+": "+errTxt(str, id);
	}
	// check if peek() contains op and if it has correct syntax setup
	function testOp() {
		if (peek().isVHD() && setup.syntaxC) {throw parseErr("vuse");}
		if (!peek().isVHD() && !setup.syntaxC) {throw parseErr("cuse");}
	}	
	
	function primary(n) { // primary :== name | literal | ( expression )
		let t=peek();
		
		if (t.isID()) { // identifier, save variable & set op type
			let v = circ.getVar(consume().id); 
			if (peek().id === "(") { // variable slice
				consume();
				t=peek();
				if (t.isID()) { // slice with index variable
					console.log("Special");
					let index = circ.getVar(consume().id);
					t=peek();
					if (t.id===")") { consume(); }
					else {throw parseErr("exp",")");}
					v = new Slice(v);
					v.sliceSetup(-1, index);					
				} else if (t.isNum()) {
					let num = Number(consume().id);
					let num2 = num;
					t=peek();
					if (t.id===":") { 
						consume(); t=peek();
						if (!t.isNum()) {throw parseErr("explit");}
						num2 = Number(consume().id);
						t=peek();
					}
					
					if (t.id===")") { consume(); }
					else {throw parseErr("exp",")");} // Expected ) 
					if (!(num>=num2)) {throw parseErr("slice",")");}
					if (type(v).array) {
						if (num>=type(v).asize){throw parseErr("slice",")");}
					} else {
						if (num>=type(v).size) {throw parseErr("slice",")");}
					}
					
					v= new Slice(v); // change
					v.sliceSetup(num, num2);
				} else {
					throw parseErr("explit");
				}
			}
			
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
			if (t.id==="~") testOp();
			let o = consume().id;
			// set empty or create new Op
			if (x.getOp()==="") {x.op(o);} 
			else {x = new Op({op:o, left:x, right:null});}			
			
			let x2 = primary(new Op({op:"", left:null, right:null}));
			x.right(x2);
			let u2 = type(x2).unsigned;
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
			} else if (sz1===1 || sz2===1) { // one operand is bit
			    sz = sz1 + sz2 - 1;
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
			
			f.set({type: {unsigned: (u1 && u2), size: sz}});					
			console.log("Term type: "+(u1 && u2)+" "+sz);			
		}
		
		return f;
	}

	function simpleExp(n) {  // simpleExp :== term {+,-,',' term}	
		let x = term(n);
		if (x === undefined) {return;}
						
		// special case for concat
		
		while (peek().id==="+" || peek().id==="-" || (peek().id==="," && !setup.syntaxC)) {
			let o;
		
			o = consume().id;			
			
			// set empty or create new Op
			if (x.getOp()==="") {x.op(o);} 
			else {x = new Op({op:o, left:x, right:null});}			
				
			// second relation
			let x2 = term(new Op({op:"", left:null, right:null})); 
			x.right(x2);
			
			const sz1 = type(x.getLeft()).size;  // compare left & right 
			const sz2 = type(x.getRight()).size;
			let sz = Math.max(sz1, sz2);  
			if (globAssignSize >= sz+1) {sz += 1;} // allow carry if assigment size fits
			
			if (o===",") {sz = sz1+sz2;}
			
			let u1 = type(x.getLeft()).unsigned;
			let u2 = type(x.getRight()).unsigned;
			
			if (!u1 && u2) { // signed & unsigned number > signed
				if (type(x.getRight()).id==="num") {
					x.set({type: {unsigned: false}});
					u2 = false;
				}
			} else if (u1 && !u2) { // unsigned num & signed > signed num
				if (type(x.getLeft()).id==="num") {
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
	
	function shift(n) {  // shift :== simpleExp {<<, >> literal}
		let x = simpleExp(n);
		if (x === undefined) {return;}
						
		if (peek().id==="<<" || peek().id===">>") {  // currently only <<
			testOp();
			let o = consume().id;
				
			// second operand (fixed number)
			let t=peek();
			
			if (t.isNum()) { // number
				let token = consume();
				let num = Number(token.id); //new NumConst(token.id, token.format()); 
				
				const sz = type(x).size;
				
				if (o==="<<") {
					if (num<1 || num+sz>64) {throw parseErr("sizeov");} //Size overflow
					
					console.log("<< "+num); //OK, <<, concat with padding zeros
					
					let pad = new NumConst("0", "b"+num);
										
					if (x.getOp()==="") {x.op(",");} 
					else {x = new Op({op:",", left:x, right:null});}
					x.right(pad);
					
					let u1 = type(x).unsigned;			
					x.set({type: {unsigned: u1, size: (sz+num)}});
				} else { // >>
				
					if (x.getOp()==="") {
						let v = x.getLeft();						
						if (v.get().isVar) {
							const n = type(v).size-1;
							if (n-num<0) {throw parseErr("sizeov");} //Size underflow
														
							let slice = new Slice(v,n,num);
							x.left(slice);							
							x.set({type: slice.get().type});  // reset the Op size
						}	
					} else {throw parseErr("unsh");}

				}
				
			} else {
				throw parseErr("explit"); //Expected numeric literal
			}
		}
		
		return x;
	}
	
	function relation(n, boolRel) {  // relation = shift {=, /=, <...} shift 
		let e = shift(n);
//console.log("parse:com: "+e.visit(true)+" Ctype: "+typeToString(type(e)));	
		if (e === undefined) {return;}
		
		let opEqual = false;
		if (peek().id==="=") {
			if (setup.syntaxC) {throw parseErr("vuse");}
			opEqual=true;  // VHDL comparison op (=)
		} 		
		if (isComparisonOp(peek().id) || opEqual) {			
			let o;
			if (opEqual) {o="=="; consume();}
			else {
				if (peek().id==="!=" || peek().id==="==") {testOp();}
				o=consume().id;				
			}
			
			if (e.getOp()==="") { // prazna operacija
				e.op(o);
				// check for id ==
				//if (o==="==" ) { // isVar ne deluje za slice!
				//	if (e.getLeft().get().isVar) {isVar = true;}
				//}
			
			} else {
				const opType={...type(e)};
				e = new Op({op:o, left:e, right:null}, opType);
			}	

			e.set({type: {bool: true}});
							
			let e2= shift(new Op({op:"", left:null, right:null}));

			e.right(e2);
			//if (isVar && type(e2).id==="num") {
//console.log("FOUND id==num!!");
			//}
			
		    // check if compare sig of same type or sig & num
			
			let sz = Math.max(type(e).size, type(e2).size);
			//let u = type(e).unsigned && type(e2).unsigned;
console.log("**** Cmp:"+o+" size: "+type(e).size+", "+type(e2).size);			
			e.set({type: {unsigned: true, size: 1}});
			
		} else if (boolRel && type(e).bool!==true) { // add required operator (value != 0)
console.log("*relation bool NORELOP");			
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
		
		//let logstr = e.visit(true);   // visit operator for statistics
		return e;
	}	
	
	function bool (n, boolRel) {  // bool :== relation { AND relation }
		let x = relation(n, boolRel);
		if (x === undefined) {return;}
						
		while ((peek().id==="&" && !setup.syntaxC) || (peek().id==="," && setup.syntaxC)) {
			let o;
			if (peek().id===",") { // consume & and set operator to ","
				consume().id;
				o = "&";
			} else {
				o = consume().id;				
			}
			
			const bool1 = type(x).bool ? true:false;

			//let o = consume().id;
			// set empty or create new Op
			if (x.getOp()==="") {x.op(o);} 
			else {x = new Op({op:o, left:x, right:null});}			
				
			// second relation
			let x2 = relation(new Op({op:"", left:null, right:null}), boolRel); 
			x.right(x2);
			const bool2 = type(x2).bool ? true:false;

console.log("BBB1:2 "+bool1+bool2);	
			if (bool1 && bool2) x.set({type: {bool: true}});
			
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
	
	function expression(n, boolRel) {  // expression :== bool { OR,XOR bool}	
		let x = bool(n, boolRel);
		let o = "?";
		if (x === undefined) {return;}
		
		while (peek().id==="|" || peek().id==="^") { 
			testOp();
			o = consume().id;
		
			if (x.getOp()==="") { // set empty or create new operation
				x.op(o);
			} else {
				const opType={...type(x)};   //copy type property
				x = new Op({op:o, left:x, right:null}, opType); // type(x)
			}
			
			const bool1 = type(x).bool ? true:false;
			
			// second relationA
			let x2 = bool(new Op({op:"", left:null, right:null}), boolRel);
			x.right(x2);
			
			const bool2 = type(x2).bool ? true:false;
			if (bool1 && bool2) x.set({type: {bool: true}});
						
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
	
	function parseAssign(v, op, pos) // assignment expression (take var v)
	{
		let a = new Statement(op);  // statement, define target, position and level
		a.setTarget(v);
		
		a.set({pos: pos});				
		a.set({level: Number(circ.getBlok().get().level)});		
		stat.setPos(pos);
		globAssignSize = type(v).size;
		
		//setLog("Assign: "+stat.getBlockLevel()); //0104
		//v.set({hdl: {assignlevel:stat.getBlockLevel()}});				
		
		// opnode
		let node = new Op({op:"", left:null, right:null});		
		node = expression(node); //exprList(node);
		
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
	
	function boolExp(n) {
		let b = expression(n, true); // set boolRel to true
				
console.log("Condition: op='"+b.getOp()+"'");
		return b;
	}
	
	function condition() {
	 let n = new Op({op:"", left:null, right:null});
	 n = boolExp(n);

console.log("parse:condition type: "+typeToString(type(n)));
	 return n;
	}
	
	function skipSeparators() {
		while (peek().isSeparator()) {consume();}
	}
	
	function parseIf(pos, oneStatement) //******** IF ***********
	{		
//console.log("IF onestatement:"+oneStatement+" prev:"+globPrevStatement);	
		let ifst = new Statement("if");
		ifst.set({level: Number(circ.getBlok().get().level)});
		ifst.set({pos: pos});
		stat.setPos(pos);
		
		stat.pushBlock();		
	
		const ifBlockName = stat.blockName();
		let ifblok = new Blok(ifBlockName);		
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
			elseBlok = new Blok(ifBlockName+"e");

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
		stat.popBlock();
		
		return ifst;
	}	
	
	function parseStatement(oneStatement) // parse & return known statement or null
	{		
		let statement = null;
		let isSlice = false;
		let indexID = "";
		
		skipSeparators();		
		let t = peek();
		
		if (t.isID()) { // identifier
		  let pos = t.pos();
		  let id = consume().id; // save first identifier
		  let delimiter = peek().id;
		  
		  if (peek().id === "(") { // variable slice
			isSlice = true;
			consume();
			t=peek();
			if (t.isID()) { // slice with index variable

				indexID = consume().id;							
				t=peek();
				if (t.id===")") { consume(); }
				else {throw parseErr("exp",")");}
			} else {
				throw parseErr("explit");
			}
		  }
		  
		  if (peek().isAssign()) {  // expect assignment
			let v = circ.getVar(id);   // get output var
			if (isSlice) {			// transform variable to slice 
				v = new Slice(v);
				v.sliceSetup(-1, circ.getVar(indexID));
			}
			if (mode(v)==="in") {
				throw parseErr("tin", id); //Assignment target: '"+id+"' is input signal!");
			}
			
			let op = consume().id;
			statement = parseAssign(v, op, pos); // return statement or undefined
						
			if (op==="<=") {circ.setSeq(true);}
		  } else if (delimiter.match(/^(:|,)$/)){ // parse declaration: sig: or sig, 
			  consume();
			  
			  let varid = new Array();
			  varid.push(id);
			  
			  while (delimiter===",") {				  
				if (peek().isID()) {
					id = consume().id;
					console.log("LIST IDENT: "+id);
					varid.push(id);					
					delimiter = consume().id;
					console.log("NEXT: "+delimiter);
				} else if (delimiter!==":") {
					delimiter = "?";
					console.log("EEE");
				}			
			  }
			  
			  let vmode = "";
			  let tmp = peek().id;
			  let vmem = false;
			  let numArray = [];
			  
			  if (tmp==="in" || tmp==="out") { // read signal mode
				vmode = consume().id;
				tmp = peek().id;
			  }
			  
			  if (peek().isNum()) {  // check if type begins with digit (array declaration) and consume 2 ident
								
				vmem = true;
				//tmp = "".concat(consume().id, consume().id); // consume number and type declaration
				// to do, check single assignment and internal signal
				tmp = consume().id;							
				if (!peek().isTypeID()) {throw parseErr("Unknown data type in array declaration!", id);}
				if (Number(tmp)<1 || Number(tmp)>1024) {throw parseErr("Unsupported size of array declaration (1-1024)!", id);}
				
				tmp = tmp.concat(consume().id);
				
				if (vmode!="") {throw parseErr("Mode in/out not allowed in array declaration!", id);}

				if (peek().id === "=") { // assignment	
					
					let n = 0;
					
					consume().id;
					if (!peek().isNum()) {throw parseErr("Expected number list!", id);}
					numArray.push([Number(consume().id),0]);
					while (peek().id === ",") {
						consume().id;
						if (!peek().isNum()) {throw parseErr("Expected number list!", id);}
						numArray.push([Number(consume().id),0]);						
					}
				}
				
			  } else {
				tmp = consume().id;  
			  }
			  
			  let declared = 1;
			  
			  varid.forEach(function (ident, j) {
				  // check if not already in ports
				  if (circ.ports.has(ident)) {throw parseErr("decl", ident);}
				  
				  declared = (j === varid.length-1) ? 1 : 2;			  
				  let obj = parsePorts(ident, vmode, tmp, declared)				  
				  if (vmem) { // add init attribute
					if (numArray.length!=0) { obj.init = numArray; }
				  }
				  circ.setPorts(ident, obj);	// set port properties
				  
				  if (circ.vars.has(ident)) {throw parseErr("decl", ident);}
				  let v = circ.getVar(ident);				  
			  });
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
	  
	  let v;
	  let mod;
	  
	  stat.getSet(Resource.FF).forEach(function(id) {  // calculate number of FFs
	      stat.incNum(type(circ.getVar(id)).size, Resource.FF);
	  });
	  
	  // check ports usage, note: in used as out checked at assignment visit,
	  //   out used as inout solved at 2nd pass visit
	  circ.ports.forEach(function (val, id) {		  
		v = circ.getVar(id, true);
		if (v!==null) {
			mod = mode(v);			
			if (mod==="out" && hdl(v).mode==="in") {  // wrong declaration or usage
				throw modelErr("vin", id); // Signal should be declared as input
			}
		}
	  });
	  
	  let whenElseList=[]; // possible traget variables for when...else, TODO
	  
	  // vars check and I/O resource usage
	  // TODO: allow multiple stateVars
	  let undeclaredIn = 0;
	  let undeclareIds = "";
	  let stateVar = "";
	  let nameList = [];
	  
	  circ.vars.forEach(function (val, id) {
		var mod = mode(val); //val.getMode();
		var mod1 = hdl(val).mode;
		if (mod1===undefined) {mod1 = "";}
		if (mod==="") { // test internal signals			
			if (mod1==="" || mod1==="out") {			
				if (!circ.ports.has(id) && setup.convUnused) {					
					setLog("Note: convert unused: "+id+" to output");
					let obj = parsePorts(id, "out", typeToString(type(val)), 1); 
					circ.setPorts(id, obj);	
					//const v = circ.getVar(id, true); // TODO v === val ??
					val.set({mode: "out"});
					
				} else {
					setLog("Note: unused variable: "+id);
				}
			}
			
			if (mod1==="in") {
				if (!circ.ports.has(id) && setup.convUnused) {
					setLog("Note: convert unused: "+id+" to input");										
					let obj = parsePorts(id, "in", typeToString(type(val)), 1);
					circ.setPorts(id, obj);					
					val.set({mode: "in"});					
				} else {
					if (undeclareIds==="") {undeclareIds = id;}
					else {undeclareIds += ","+id;}
					
					//setLog("Note: variable: "+id+" should be declared as input!");
					undeclaredIn += 1;
				}
			}			
		}
		
		if (mod==="in" || mod==="out") {
			stat.incNum(type(val).size, Resource.IO);
		}
		if (hdl(val).assignments>1) {
			stat.incNum(1, Resource.MUX);
		
			// search for stateVar: <=, only undefined input variable assigments 
			if (hdl(val).assignop==="<=" && hdl(val).names.size>1) {
				let test = 0;
				hdl(val).names.forEach(function (varName) { // browse all variable names
					vn = circ.getVar(varName, true);
					if (vn!==null) {					
						mod = mode(vn);			
						if (mod==="" && hdl(vn).mode==="in") {
							if (test===0) {nameList = [];}
							test += 1;
							nameList.push(varName);
						} else {
							test = 0;
							
						}
					}
				});
					
				//const firstName = hdl(val).names.values().next();
				//setLog("Check:"+firstName.value );
				//const v1 = circ.getVar(hdl(val).names[0], true);
				//if (mode(v1)==="" && hdl(v1).mode==="in") {
				if (test>0) {
					stateVar = id;
				}
				//}
			}			
		}
		// when...else ?
		if (hdl(val).assignop==="=" && hdl(val).assignments===2) {whenElseList.push(id);}

		
		
	  });

	if (undeclaredIn>0) {
		setLog("Note: variable: "+undeclareIds+" should be declared as input!");
	}
	// enumerate stateVar
	
	
	if (stateVar!="") {
		nameList.sort();
		setLog("Enumerating variables: "+nameList);
		let enumVal = 0;
		nameList.forEach(function (varName) {
			v = circ.getVar(varName, true);
			v.set({hdl: {mode: "const"}});
			v.set({hdl: {val: enumVal}});
			v.setVal(vec.parse(enumVal));
			
			enumVal += 1;
		});
	}
	  
//console.log(whenElseList);  
	  whenElseList.forEach(function(id) {		  
		  circ.getBlok().statements.forEach(function(st) {
			 if (st.get().id==="if") {
				let block = st.get().ifBlock;				
				if (block.statements[0].get().id==="=" && block.statements[0].get().target.get().name===id) {					
					let block2 = st.get().elseBlock;
					if (block2!==null) {
						if (block2.statements[0].get().id==="=" && block2.statements[0].get().target.get().name===id) {
console.log("***TODO*** found "+id+" in IF-ELSE block");
						}
					}				
				}				
			 }
			 
		  });
		  
	  });

	  setStat(stat.emit());	  
	  
	  if (log) {
		let sigmode = "";
		let as = "";
		console.log(logStr);  // log parsed tree and signals
		//logStr = circ.visit(2); // ********** še enkrat
		//console.log(logStr);
		
		console.log("Sequential: "+circ.getSeq());
		
		/*let str = "";
		circ.ports.forEach(function (val, id) {
			str+=id+", ";
		});			
		console.log("Ports: "+str);	*/
		

		console.log("Signals: ");
		circ.vars.forEach(function(v) {
			sigmode = ",";
			if (hdl(v).mode!==undefined) sigmode=","+hdl(v).mode;
			as = ",";
			if (hdl(v).assignop!==undefined) {as=","+hdl(v).assignop+hdl(v).assignments;}
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
