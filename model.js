/*File: model.js */
/*jshint esversion: 6 */
/*jslint bitwise: true */
/* Methods: common
 get(), set() - get or set object
 val() - return numeric(vector) value of num, var or op
 visit() - visit the object, perform analysis, return string (log purpose)
 emitVHD() - return VHDL representation of object
 count() - count the number ob operands (var,num=1, op>=1)
 */

const log = true;
const logval = true;
const logset = false;

// util functions
// get variable object and return mode, type
function mode(v) {return v.get().mode;}
function type(v) {
	if (v.get().type===undefined) {console.log("type undefined!");}
	return v.get().type;
}
function typeToString(t) { // convert type object to string
	if (t.unsigned) {return "u"+t.size;}
	if (t.unsigned===false) {return "s"+t.size;}
	return "?"+t.size;
}
function hdl(v) { // return hdl object or default object
	let o=v.get();
	
	if (o.hasOwnProperty("hdl")) {return v.get().hdl;}
	return {mode:"*", assignments:0}; // mode, numbar of assignment, ...
}
function setHdlMode(v, mode) {
	let mode0=hdl(v).mode;
	
	if (mode==="in") {
		if (mode0==="" || mode0===undefined) {v.set({hdl: {mode: "in"}});}
	    else if (mode0==="out") {v.set({hdl: {mode: "inout"}});}
	} else if (mode==="out") {		
		if (mode0==="" || mode0===undefined) {v.set({hdl: {mode: "out"}});}
	    else if (mode0==="in") {v.set({hdl: {mode: "inout"}});}
	}
}

let Resource={IO:0, FF:1, BOOL:2, ARIT:3, CMP:4, MUX:5, IOID:6};

function Stat() {    // statistics and tmp values
	let numIO = 0;
	let numFF = 0;
	let numBool = 0;
	let numArit = 0;
	let numCmp = 0;
	let numMux = 0;
	let io = new Set([]); // I/O variables
	let ff = new Set([]);
	let item = [];        // temporary save variable identifiers
	let pos = {x:0, y:0}; // model visit position
	
	function init() {
		numIO = 0;
		numFF = 0;
		numBool = 0;
		numArit = 0;
		numCmp = 0;
		numMux = 0;
		io = new Set([]);
		ff = new Set([]);
	}
	
	function initItem() { item = []; }	
	function pushItem(o) { item.push(o); }
	function getItem() { return item;}
	
	function setPos(p) { pos = p; }
	function getPos() { return pos;}
	
	function addID(id, set) { // add identifier to set
		if (set===Resource.IO) {io.add(id)};
		if (set===Resource.FF) {ff.add(id)};
	}
	function getSet(set) { // get seleceted Set()
		if (set===Resource.IO) {return io;}
		if (set===Resource.FF) {return ff;}
	}
	
	function incNum(n, resource) {
		switch (resource) {
		 case Resource.IO: numIO += n; break;
		 case Resource.FF: numFF += n; break;
		 case Resource.BOOL: numBool += n; break;
		 case Resource.ARIT: numArit += n; break;
		 case Resource.CMP: numCmp += n; break;
		 case Resource.MUX: numMux += n; break;
		}
	}

	function emit() {
		let s = "I/O pins  : "+numIO+"<br>\n";
		s += "Flip-flops: "+numFF+"<br>\n";
		s += "Log gates: "+numBool+"<br>\n";
		s += "Arith op.: "+numArit+"<br>\n";
		s += "Comp op.: "+numCmp+"<br>\n";
		s += "Mux: "+numMux;
		return s;
	}
	
	return {init, initItem, pushItem, getItem, setPos, getPos, addID, getSet, incNum, emit};
}

stat = new Stat(); // global status object, resource statistics and global tmp values

function NumConst(n, fmt) { "use strict";
	let num = 0;
	let value = [0, 0];
	let obj = {unsigned:true, size:0};
	const format = fmt;	
	
	if (n[0]==="-") {
		num = Number(n.slice(1));
		const tmp = vec.op("-", vec.zero, [num, 0]);
		value = [tmp[0], tmp[1]];
		obj.size = num.toString(2).length+1;
		obj.unsigned = false;
//console.log("NUM value: "+value);		
		if (logval) {console.log("NumConst negative!");}
	} else {
		num = Number(n);
		value = [num, 0];
		obj.size = num.toString(2).length;
		if (logval) {console.log("NumConst "+obj.size);}
	}

	function val() {return value;}
		
	function get() {
		return {type: {id:"num", unsigned:obj.unsigned, size:obj.size}, format:format};
	}
	
    function visit() {return value[0].toString();}
	function emitVHD() {	
		// check for negative value (signed numeric constant)	
		if (obj.unsigned===false) {
			let c = vec.complement(value);
			return "-"+c[0].toString();
		}
		return value[0].toString();
	}
	function count() {return 1;}
	 
	return {val, get, visit, emitVHD, count};
}


function Var(s) { "use strict";
 let obj = {name:s, mode:"", type:{id:"sig", unsigned:true, size:0}, mask:[0, 0], hdl:{}}; // target:"" or "=" numtarget:0, 1, 
 let value = [0, 0];
 let nextValue = [0, 0];
 let update = false;
 
 function val() {return value;} 

 function setVal(v) {
	if (!(Array.isArray(v) && v.length===2)) {
		console.log("Var.setVal param error");
		return;
	}	 
	value[0] = v[0] & obj.mask[0];
	value[1] = v[1] & obj.mask[1];
	
	if (obj.type.unsigned) {
		value[0] >>>= 0;
		value[1] >>>= 0;
	} else {
		if (obj.size>32) {console.log("Signed>32 not supported!");}
		//console.log("S"+(value[0]&(1 <<(obj.size-1))));
		if ((value[0]&(1 <<(obj.size-1)))!==0) {
			value[0] = value[0] | ~obj.mask[0];
			value[1] = 0xFFFFFFFF;
		}
	}
	if (logset) {console.log("set val "+obj.name+"="+vec.out(value, obj.unsigned)+" 0x"+vec.hex(value));}
 }
 
 function get() {return obj;}
 
 function set(o) {
	let log ="";
	
	if (o.hasOwnProperty("name")) {obj.name = o.name;}
	if (o.hasOwnProperty("mode")) {obj.mode = o.mode;}
	
	if (o.hasOwnProperty("type")) {	
		if (o.type.hasOwnProperty("id")) {obj.type.id = o.type.id; log+=" id:"+o.type.id;}
		if (o.type.hasOwnProperty("size")) {  // set size, compute type id and mask 
			obj.type.size = o.type.size; 
			if (o.type.size===1) {obj.type.id="bit";}			
		    Object.assign(obj.mask, vec.mask(obj.type.size));	
			log+=" size:"+o.type.size;
		}
		if (o.type.hasOwnProperty("unsigned")) {obj.type.unsigned = o.type.unsigned; log+=" u:"+o.type.unsigned;}	    
		if (logset) {console.log("Var.set type "+log);}
	}
	
	if (o.hasOwnProperty("hdl")) {
		if (o.hdl.hasOwnProperty("mode")) {obj.hdl.mode = o.hdl.mode; log+=" mode:"+o.hdl.mode;}
		if (o.hdl.hasOwnProperty("assignments")) {obj.hdl.assignments = o.hdl.assignments; log+=" a:"+o.hdl.assignments;}
		if (o.hdl.hasOwnProperty("assignop")) {obj.hdl.assignop = o.hdl.assignop; log+=" op"+o.hdl.assignop;}
		if (o.hdl.hasOwnProperty("val")) {obj.hdl.val = o.hdl.val; log+=" v="+o.hdl.val;}
		if (logset) {console.log("Var.set hdl "+log);}
	}
 }
 
 function setNext(n) { // if masked input != value, set nextValue & return true
	if (!(Array.isArray(n) && n.length===2)) {
		console.log("Var.setNext param error");
		return;
	}
	nextValue[0] = (n[0] & obj.mask[0])>>>0;
	nextValue[1] = n[1] & obj.mask[1];
	if (obj.type.unsigned===false) {
//console.log("Sign fix");
		if (obj.type.size>32) {console.log("Signed>32 not supported!");}
		if ((nextValue[0]&(1 <<(obj.type.size-1)))!==0) {
			nextValue[0] = nextValue[0] | ~obj.mask[0];
			nextValue[1] = 0xFFFFFFFF;
		}
	}
	
	update = false;	
	if (nextValue[0] !== value[0] || nextValue[1] !== value[1]) {		
		if (logval) {console.log("NEW next val "+obj.name+" = "+vec.hex(nextValue)+" m:"+vec.hex(obj.mask));}
		update = true;
	} 
	return update;	 
 }
 
 function next() {
	 if (update) {
		Object.assign(value, nextValue);
		//console.log("Update "+obj.name+" "+vec.hex(nextValue));
		update = false;
		return true;
	 }
	 return false;
 }
 
 function visit() {
	 stat.pushItem(obj.name);
	 return obj.name;
 }
 function emitVHD() {return obj.name;}
 function count() {return 1;}

 return {get, set, val, setVal, setNext, next, visit, emitVHD, count};
} // Var

function Op(o, optType) { "use strict";
 let obj = o; //{left:null, op:"", right:null, type:""};
 obj.type = optType===undefined ? {id:"", unsigned:true, size:0} : optType;
 let numOperands = 0;
 
 function left(v)  {obj.left = v;}
 function getLeft() {return obj.left;}
 
 function right(v) {obj.right = v;}
 function getRight() {return obj.right;}

 function op(v)    {obj.op = v;}
 function getOp()  {return obj.op;}

 function get() {
//	console.log("Op.get type: '"+obj.type.id+"' "+obj.type.size+" "+obj.type.unsigned);
	return obj;
 }
 
 function set(o) {
	let log ="";
	
	if (o.hasOwnProperty("type")) {		
		if (o.type.hasOwnProperty("id")) {obj.type.id = o.type.id; log+=" id:"+o.type.id;}
		if (o.type.hasOwnProperty("size")) {obj.type.size = o.type.size; log+=" size:"+o.type.size;}
		if (o.type.hasOwnProperty("unsigned")) {obj.type.unsigned = o.type.unsigned; log+=" u:"+o.type.unsigned;}
	    if (logset) {console.log("Op.set "+obj.op+" type "+log);}
	}
 }
 
 function val() {
	if (obj.op==="") {return obj.left.val();}
	if (obj.left===null) {
	  return vec.unary(obj.op, obj.right.val());
	}
	if (isComparisonOp(obj.op)) {
		return vec.cmp(obj.op, obj.left.val(), obj.right.val());
	}	
	return vec.op(obj.op, obj.left.val(), obj.right.val());
 } 
		
 function visit(statistics) { // visit op tree, set op id & return description string
	let str = "";
	let id2 = ""; // right (second) operand id
	let no = 0;   // num of operands

//console.log("BEGIN Op.Visit: "+obj.op+" type: '"+obj.type.id+"' "+obj.type.size+" "+obj.type.unsigned);	
	if (obj.op==="") {		
		str=" ";
		if (obj.left!==null) {
			str += obj.left.visit(statistics); 
			no += obj.left.count();
			obj.type.id = type(obj.left).id;//  obj.left.getType().type.id;
			//console.log("!!!Op type: "+obj.type.id);
		}
	} else {
		if (isComparisonOp(obj.op)) { // test comparison
			if (obj.left===null || obj.right===null) {
				console.log("op.visit: Unexpected empty comparison!");
			} else {				
				// check if compare sig of same type and different size or sign
				if (type(obj.left).id === "sig" && type(obj.right).id === "sig") {
					if (type(obj.left).size !== type(obj.right).size) {
						throw modelErr("cmpsz", "", stat.getPos());
						// Illegal comparison of different size variables!
					}
					if (type(obj.left).unsigned !== type(obj.right).unsigned) { // Illegal signed/unsigned
						throw modelErr("cmpm", "", stat.getPos());
					}	
				} else if (type(obj.right).id === "num") { // compare to number
					if (type(obj.left).size===1) {
						let n = Number(vec.out(obj.right.val()));
						if (n!==0 && n!==1) {
							throw modelErr("cmpb", "", stat.getPos());
						}
					}
					if (type(obj.left).unsigned && !type(obj.right).unsigned) { // illegal unsigned to signed num
						throw modelErr("cmpm", "", stat.getPos());
					}
					
				} else if (type(obj.left).id === "num") {
					if (type(obj.right).size===1) {
						let n = Number(vec.out(obj.left.val()));
						if (n!==0 && n!==1) {
							throw modelErr("cmpb", "", stat.getPos());
						}
					}
					if (!type(obj.left).unsigned && type(obj.right).unsigned) { // illegal signed num to unsigned
						throw modelErr("cmpm", "", stat.getPos());
					}					
				}
			}
			
		}
		
		str = "(";
		if (obj.left!==null) { // visit left
			str += obj.left.visit(statistics); 
			no += obj.left.count();
			obj.type.id = type(obj.left).id;  // id(op) <= id(left)
		}
		str += " "+obj.op+" ";
		if (obj.right!==null) { // visit right

			str += obj.right.visit(statistics); 
			no += obj.right.count();
			id2 = type(obj.right).id;
			if (obj.type.id==="") { // only one id set (single operand)
				obj.type.id = id2;			
			} else {	
				if (obj.type.id!==id2) { // resolve different left and right id
					if (id2==="sig") {obj.type.id = "sig";}
					else if (id2==="bit") {
						if (obj.type.id==="bit" || obj.type.id==="num") {obj.type.id = "bit";}
					} else if (id2==="num") {
						obj.type.id = obj.type.id;
					} else {console.log("Op.visit unexpected type id! "+id2);}
				}
			}
		}
		str += ")";
		if (statistics===true) { // compute operation statistics
			str += " type: "+obj.type.id+" "+typeToString(obj.type);
			if (obj.op==="&" || obj.op==="|" || obj.op==="^" || obj.op==="~") {
				stat.incNum(obj.type.size, Resource.BOOL);
			} else if (obj.op==="+" || obj.op==="-" || obj.op==="*") {
				stat.incNum(1, Resource.ARIT);
			} else if (isComparisonOp(obj.op)) { 
				stat.incNum(1, Resource.CMP);
			}
		} 
	}
	numOperands = no;
//console.log("END Op.Visit: "+obj.op+" type: '"+obj.type.id+"' "+obj.type.size+" "+obj.type.unsigned);
	return str;
 }

 function resizeVar(str, newsize, oldsize) {  // resize sig or bit
    if (newsize === oldsize) return str;
	if (Number(oldsize)===1) {
		return "((0 => "+str+", others => '0'))"; // (( začasno, da ne pobriše))
	} else if (Number(newsize)===1) {
		return str+"(0)";
	}
	return "resize("+str+","+newsize+")";
 }
 
 function emitVHD() {
	let str = "";
	let numStr = "";
	let exp = "";
	let op = "";
	let lt = null;
	let rt = null;

	if (obj.op==="") {  // single operand, check operand & op data type
		str="";
		if (obj.left!==null) {
			console.log("A1 "+type(obj.left).size+" "+obj.type.size);
			if (type(obj.left).size !== obj.type.size) { // left size <> op size, set by Statement.visit (NOTE)
// check if numeric variable
				if (type(obj.left).id==="num") {					
					str += obj.left.emitVHD();
			    } else {				
					str += resizeVar(obj.left.emitVHD(), obj.type.size, type(obj.left).size);	
				}
			} else {
				str += obj.left.emitVHD();
			}
			if (type(obj.left).unsigned !== obj.type.unsigned) {console.log("op.emit Unexpected different SIGN!");}
		}
	} else {
		op = obj.op;  // set operation string
		switch(op) {
			case "~": op = "not"; break;
			case "+": 			
			case "-": op = op; break;
			case "*": op = op; break;
			case "&": 
			case "&&": op = "and"; break;
			case "|":
			case "||": op = "or"; break;
			case "^":  op ="xor"; break;
			case "==": op = "="; break;
			case "!=": op = "/="; break;
			case "<": op = "<"; break;
			case "<=": op = "<="; break;
			case ">": op = ">"; break;
			case ">=": op = ">="; break;			
			default: console.log("on.emitVHD: unknown operation!");
		}		
				
		if (obj.left === null) { // unary op
			str = op+" "+obj.right.emitVHD();
			
		} else if ((obj.left!==null) && (obj.right!==null)) {  // binary op, get size & op	
		
			lt = type(obj.left);
			rt = type(obj.right);
			if (isComparisonOp(obj.op)) { // handle comparison
				if ((lt.id==="bit") && (rt.id==="num")) {
					str = obj.left.emitVHD()+" "+op+" '"+obj.right.emitVHD()+"'";
				} else if ((lt.id==="num") && (rt.id==="bit")) {
					str = "'"+obj.left.emitVHD()+"' "+op+" "+obj.right.emitVHD();
				} else {
					str = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
				}
			} else {
				
				str = "(";
				if (lt.id==="num") {
					if (rt.id==="num") {
console.log("CALC!");	// ERR: x = 2-3					
						return vec.out(val());
						} // return calculated value !
					if (rt.id==="bit") { // TODO num cast: 0, 1
						exp = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
						str += resizeVar(exp, obj.type.size, 1);
					} else if (rt.id==="sig") {
						if (rt.unsigned) { // convert number to string
							numStr = "to_unsigned("+obj.left.emitVHD()+","+rt.size+")";
						} else {
							numStr = "to_signed("+obj.left.emitVHD()+","+rt.size+")";							
						}
						exp = numStr+" "+op+" "+obj.right.emitVHD();
						if (rt.size === obj.type.size) {
							str += exp;
						} else {
							str += resizeVar(exp, obj.type.size, 2);
						}
					} else {
						console.log("op.emitVHD 1");
					}
				} else if (lt.id==="bit") {
					if (rt.id==="num") {  // TODO num cast: 0, 1
						exp = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
						str += resizeVar(exp, obj.type.size, 1);
					} else if (rt.id==="bit") {
						exp = obj.left.emitVHD()+"  "+op+" "+obj.right.emitVHD();						
						str += resizeVar(exp, obj.type.size, 1);
					} else if (rt.id==="sig") { //  bit to vector						
						if (op==="+" || op==="-") { // special for arithmetic op
							if (rt.unsigned) {
								str +=  "unsigned'(\"\" & "+obj.left.emitVHD()+") "+op+" "+obj.right.emitVHD();
							} else {
								str +=  "signed'(\"\" & "+obj.left.emitVHD()+") "+op+" "+obj.right.emitVHD();
							}
						} else { // use aggregate for signed & unsigned
							exp = "(0=>"+obj.left.emitVHD()+", ("+(Number(rt.size)-1)+" downto 1)=>'0') "+ 
							op+" "+obj.right.emitVHD();
						}
						
						if (rt.size === obj.type.size) {
							str += exp;
						} else {
						   str += resizeVar(exp, obj.type.size, 2);
						}
					} else {
						console.log("op.emitVHD 2");
					}
				} else if (lt.id==="sig") {			
					if (rt.id==="num") {  // check if operation is possible (+,-, or, ...)											
						if (op==="+" || op==="-") {  // sig +/- num do not require integer conversion
							numStr = obj.right.emitVHD();
							if (obj.type.size === lt.size) {
								str += obj.left.emitVHD()+" "+op+"  "+numStr;
							} else {  // resize only sig	
								str += "resize("+obj.left.emitVHD()+","+(obj.type.size)+") "+op+"  "+numStr;
							}					
						} else {							
							if (lt.unsigned) { // convert number to string
								numStr = "to_unsigned("+obj.right.emitVHD()+","+lt.size+")";
							} else {
								numStr = "to_signed("+obj.right.emitVHD()+","+lt.size+")";							
							}							
							if (obj.type.size === lt.size) {
								str += obj.left.emitVHD()+" "+op+" "+numStr;
							} else {  // resize expression
								exp = obj.left.emitVHD()+" "+op+" "+numStr;
								str += resizeVar(exp, obj.type.size, 2);
							}
						}						
					} else if (rt.id==="bit") {						
						if (op==="+" || op==="-") { // special for arithmetic op
							if (lt.unsigned) {
								str += obj.left.emitVHD()+" "+op+" unsigned'(\"\" & "+obj.right.emitVHD()+")";
							} else {
								str += obj.left.emitVHD()+" "+op+" signed'(\"\" & "+obj.right.emitVHD()+")";
							}
						} else { // use aggregate for signed & unsigned
							exp = obj.left.emitVHD()+" "+op+" (0=>"+obj.right.emitVHD()+", ("+(Number(lt.size)-1)+" downto 1)=>'0')";
						}
						
						if (lt.size === obj.type.size) {
							str += exp;
						} else {
							str += resizeVar(exp, obj.type.size, 2);
						}
					} else if (rt.id==="sig") { 
						// check +/- for carry (resize one )
						if ((op==="+" || op==="-") && (obj.type.size > Math.max(lt.size, rt.size))) {
							str += resizeVar(obj.left.emitVHD(), obj.type.size, lt.size)+" "+op+"  "+
								   resizeVar(obj.right.emitVHD(), obj.type.size, rt.size);
						} else if (op==="*") {
							str += resizeVar(obj.left.emitVHD()+op+obj.right.emitVHD(), obj.type.size, lt.size+rt.size);
						} else {
							if (lt.size === rt.size) {  // resize operand ?
								exp = obj.left.emitVHD()+" "+op+"  "+obj.right.emitVHD();
							} else if (lt.size < rt.size) {
								exp = resizeVar(obj.left.emitVHD(), rt.size, lt.size)+" "+op+"  "+obj.right.emitVHD();
							} else {
								exp += obj.left.emitVHD()+" "+op+" "+resizeVar(obj.right.emitVHD(), lt.size, rt.size);
							}							
							if (lt.size === obj.type.size) {
								str += exp;
							} else {
								str += resizeVar(exp, obj.type.size, 2);
							}
						}
					} else {
						console.log("op.emitVHD 2");
					}
					
				} else {
						console.log("op.emitVHD 5");
				}
				str += ")";
							
			}
		}
	}
	return str;
 }
 
 function count() {
	 return numOperands;
 }
 
 return {obj, get, set, val, left, getLeft, right, getRight, op, getOp, visit, emitVHD, count};
}

/* generic statement
   assign: target = var, expr = expression
   if: expr = condition, block = if block, elseblock = else block
   target > obj.target
   */
function Statement(t) {  "use strict"; 
	let obj = {id: t, target: null, expr: null, ifBlock: null, elseBlock: null, translated: false, level:0, pos:{x:0, y:0}};
		
	function get() {
		return obj;
	}
	
	function set(o) {
		let log="";
		if (o.hasOwnProperty("translated")) {obj.translated = o.translated; log+="translated:"+o.translated;}
		if (o.hasOwnProperty("level")) {obj.level = o.level; log+="level:"+o.level;}
		if (o.hasOwnProperty("pos")) {obj.pos = o.pos;}
		if (o.hasOwnProperty("combProc")) {obj.combProc = o.combProc; log+=" cp:"+o.combProc;}
		if (o.hasOwnProperty("seqProc")) {obj.seqProc = o.seqProc; log+=" sp:"+o.seqProc;}
		if (logset) {console.log("Statement.set "+obj.id+log);}
	}	
	
	function setExpr(e) {
		obj.expr = e;
	}
	
	function setTarget(d) {
		obj.target = d;
	}
	
	function setIf(b1, b2) {
		obj.ifBlock = b1;
		obj.elseBlock = b2;
	}
	
	function val(firstCycle) {
		let change = false;
		
		if (obj.id==="=" || (firstCycle && (obj.id==="<="))) {
			let res = obj.expr.val(); 
			if (logval) {
				console.log("St.val "+obj.target.get().name+" = "+vec.hex(res)+", old:"+vec.hex(obj.target.val()));
			}
			return obj.target.setNext(res);  // true, if value changed
		}
		if (obj.id==="if") {
			let b = obj.expr.val();
			//if (log) {console.log(obj.expr.visit()+ " == "+b);}
			if (!vec.isZero(b)) { 
				if (logval) {console.log("St.val if "+obj.expr.visit()+": true");}
				obj.ifBlock.statements.forEach(function(st) {
					if (st.val(firstCycle)) {change = true;}
				});
			} else if (obj.elseBlock!==null) { // else exists
			    if (logval) {console.log("St.val if "+obj.expr.visit()+": false");}
				obj.elseBlock.statements.forEach(function(st) {
					if (st.val(firstCycle)) {change = true;}
				});			
			}
			return change;
		}
		return false;
	}
	
	function visit(pass, vars) {  // Statement.visit		
		let str = obj.id+": ";
		let assignments = 0;
		if (log) {console.log("Statement.visit: "+pass);}
		
		if (obj.id==="=" || obj.id==="<=") {
			if (pass===1) { // first pass, indentify number & type of assignments, count operands			
			    if (obj.id==="<=") {stat.addID(obj.target.get().name, Resource.FF);} // save id
				
				let assignop = hdl(obj.target).assignop;			
				if ((assignop==="=" && obj.id==="<=") || (assignop==="<=" && obj.id==="=")) {
					throw modelErr("mix", "", stat.getPos()); //Mixed comb and sequential assignments!
				}
		
				assignments = hdl(obj.target).assignments;
				if (assignments===undefined) {assignments=0;}

				obj.target.set({hdl: {assignments:assignments+1, assignop:obj.id}}); 
				
				str += obj.target.visit()+"= "; // visit target, set mode=out
				setHdlMode(obj.target, "out");
				
				if (obj.expr === null) {str+="?";} 
				else {				
					stat.initItem();
					str += obj.expr.visit();  // visit expression, count operands, set var mode = in				
					for (const id of stat.getItem()) {
						setHdlMode(vars.get(id), "in");
					}
				}
				
				if (type(obj.target).size !== type(obj.expr).size) {  // NOTE: Resize assignment, correct expr op
					if (log) {console.log("Statement.visit: size difference "+type(obj.target).size+" "+type(obj.expr).size);}
					obj.expr.set({type: {size: type(obj.target).size}});
				}
				
			} else {  // second pass
				if (obj.expr.count()===1) {  // single assignment to num => constant
					if ((type(obj.expr).id==="num") && (hdl(obj.target).assignments===1)
						&& mode(obj.target)!=="out") {						
						if (type(obj.target).unsigned && !type(obj.expr).unsigned) { // signed num to unsigned const
							const mask = vec.mask(type(obj.target).size);
							obj.target.set({hdl: {mode:"const", val:(obj.expr.val()[0] & mask[0])}});
						} else {
							obj.target.set({hdl: {mode:"const", val:vec.out(obj.expr.val())}});
						}
						obj.translated = true;// exclude from translation to VHDL statements
					}
				}
				// out signal used as inout
				if (mode(obj.target)==="out" && hdl(obj.target).mode==="inout") { 
					const old = obj.target;
					
					old.set({hdl: {mode: "out"}});
					
					let name = obj.target.get().name;
					const tip = type(obj.target);
					
					let newname = name + "_sig";
										
					obj.target.set({name: newname, mode: ""}); // rename x > xsig, mode = int. signal
					
					const v = model.getVar(newname);  // new var x, copy type, mode = out
					v.set({name: name, mode: "out", type: tip});
					v.set({hdl: {assignments: 1}});
					const st = new Statement("=");
					let op = new Op({op:"", left:obj.target, right:null});
					op.set({type: type(old)});
					
					st.setTarget(v);					
					st.setExpr(op);				
					model.push(st);
				}
			}
			
		} else if (obj.id==="if") {
			if (pass===1) {
				stat.initItem();
				str += obj.expr.visit()+"\n";
				for (const id of stat.getItem()) {
					setHdlMode(vars.get(id), "in");
				}
				
				str += obj.ifBlock.visit(pass, vars);
				if (obj.elseBlock!==null) {
					str += "else " + obj.elseBlock.visit(pass, vars);				
				}
			} else if (pass===2) {				
				str += obj.ifBlock.visit(pass, vars);
				if (obj.elseBlock!==null) {
					str += "else " + obj.elseBlock.visit(pass, vars);				
				}
			}
		}
		return str;
	}
	
	// output VHD code for combinational or sequential logic
	function emitVHD(indent, isComb) {
		let str = "";
		let spaces = " ".repeat(indent)+" ".repeat(3*Number(obj.level));
		let expStr = "";
		let num = 0;
		if ((obj.id==="=" && isComb) || (obj.id==="<=" && !isComb)) {	// assignment						
			if (obj.expr === null) {return "?";} // unexpected empty expression
						
			expStr = obj.expr.emitVHD();
			let lsz = type(obj.target).size;
			let rsz = type(obj.expr).size;
			if (obj.expr.count()===1) { // single item assignment (num, sig or bit)
				let v = null;

				if (obj.expr.getOp()==="") {
					v = obj.expr.getLeft();
				} else {
					v = obj.expr.getRight(); // TODO resolve unary op, unary - only for signed !!
				}
									
				if (type(v).id==="num") { // special code for number assignment
						if (lsz===1) {								
							num = Number(expStr);
							if (num!==0 && num!==1) {
								setLog("emitVHD: Assigned number expected 0 or 1!");
							}							
							if (num%2===0) {str += "'0'";}
							else {str += "'1'";}								
						} else {
							if (type(obj.target).unsigned) {			
								if (!type(v).unsigned) { // signed int to unsigned, special case
									const mask = vec.mask(lsz);							
									str += "to_unsigned("+(v.val()[0] & mask[0])+","+lsz+")";
								} else {									
									str += "to_unsigned("+expStr+","+lsz+")";
								}
							} else {
								str += "to_signed("+expStr+","+lsz+")";
							}
						}
				} else {
	
					if (lsz!==rsz) {   // signal, different size
						if (lsz===1) { // bit <- sig 
							expStr += "(0)";
						} else if (type(v).id==="bit") { // sig <- bit
							expStr = "(0 => "+expStr+", others => '0')";
						} else { // sig <- sig
							expStr = "resize("+expStr+","+lsz+")";
						}
					}
										
					if (type(obj.target).unsigned && !type(obj.expr).unsigned) {
						str += "unsigned("+expStr+")";
					} else if (!type(obj.target).unsigned && type(obj.expr).unsigned) {
						str += "signed("+expStr+")";
					} else {
						str += expStr;
					}
				}				
			} else { // expression assignment
				// TODO 1 bit !
				if (type(obj.expr).id==="num") { // special code for number assignment
						if (lsz===1) {								
							num = Number(expStr);
							if (num!==0 && num!==1) {
								setLog("emitVHD: Assigned number expected 0 or 1!");
							}							
							if (num%2===0) {str += "'0'";}
							else {str += "'1'";}								
						} else {
							if (type(obj.target).unsigned) {
								str += "to_unsigned("+expStr+","+lsz+")";
							} else {
								str += "to_signed("+expStr+","+lsz+")";
							}
						}
				} else {					
					if (lsz!==rsz) {
						expStr = "resize("+expStr+","+lsz+")";
					}
					if (type(obj.target).unsigned && !type(obj.expr).unsigned) {
						str += "unsigned("+expStr+")";
					} else if (!type(obj.target).unsigned && type(obj.expr).unsigned) {
						str += "signed("+expStr+")";
					} else {
						str += expStr;
					}
				}
			}	

			if (str.slice(0,1)==="(" && str.slice(-1)===")") {
				console.log("Slice ()");
				str = str.slice(1, -1);
			}
			str = spaces + obj.target.visit()+" <= "+str+";\n";
			
			//str += "\n";
		} else if (obj.id==="if") {  // if statement, check if belongs to comb 
			if ((obj.combProc && isComb) || (obj.seqProc && !isComb)) {
			
				str = spaces+"if "+obj.expr.emitVHD()+" then\n";

				obj.ifBlock.statements.forEach(function (st) {
					str += st.emitVHD(indent, isComb);
				});
				if (obj.elseBlock!==null) {
					str += spaces+"else\n";
					obj.elseBlock.statements.forEach(function(st) {
						str += st.emitVHD(indent,  isComb);
					});			
				}

				str += spaces + "end if;\n";
			}
		}
		return str;
	}

	
	if (log) {console.log("Statement: "+obj.id);}
	return {get, set, setTarget, setExpr, setIf, val, visit, emitVHD};
}

function Blok(namestring) {
 let obj = {name:namestring, combCnt:0, seqCnt:0, level:0};
 let statements = [];
 let targets = [];

 function get() {
	 return obj;
 }
 
 function set(o) {
	let log="";
	if (o.hasOwnProperty("combCnt")) {obj.combCnt = o.combCnt; log+="ccnt: "+o.combCnt;}	 
	if (o.hasOwnProperty("seqCnt")) {obj.seqCnt = o.seqCnt; log+="scnt: "+o.seqCnt;}
	if (o.hasOwnProperty("level")) {obj.level = o.level; log+="level:"+o.level;}
//console.log("Blok.set "+log);
 }
 
 function push(st) {
	 statements.push(st);
 }
 
 function visit(pass, vars) {
//console.log("Block.visit "+pass+" "+obj.name);	 
    let str = "Blok("+obj.level+"): \n";
	statements.forEach(function (st) {
		stat.setPos(st.get().pos); // save current visit statement position
		if (pass===1) {
			if (st.get().id==="=") {obj.combCnt += 1;}
			if (st.get().id==="<=") {obj.seqCnt += 1;}
		}
		str += st.visit(pass, vars)+"\n";
		if (pass===1 && (st.get().id==="=" || st.get().id==="<=")) {
			let id = st.get().target.get().name; 
//console.log("Blok: = "+id);
			if (targets.includes(id)) {	
			//Multiple assignments to "+id+" in the same block!
				throw modelErr("mult", id, st.get().pos); // Multiple assignments to "+id+" in the same block!", st.get().pos);				
			} else {
			  targets.push(id);
			}
		}
	});
	if (log) {console.log("Block: comb="+obj.combCnt+" seq="+obj.seqCnt);}
	return str;	
 }
	
 return {get, set, statements, targets, push, visit};
}