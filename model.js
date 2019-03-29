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
const logset = true;

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

function bitString(valStr, size) {  // number to VHDL binary bit string
	const bin = Number(valStr).toString(2);	
	const numSz = bin.length;
	
	if (numSz <= size) {
		return "\""+bin.padStart(size, '0')+"\"";
	}		
	return "\""+bin.slice(-size)+"\""; // Number overflow
}

 // number to VHDL code: convert, resize, set format 
 //  in: value string, type: size, unsigned and out format specifier 
 function numVHD(numStr, objType, outFormat) {
	if (objType.size === undefined || objType.unsigned === undefined) {
		console.log("iErr: numVHD undefined objType!");
		return "";
	} 
	const num = Number(numStr);
	const size = objType.size;
	const unsigned = objType.unsigned;
	
	if (size===1) {
		if (num!==0 && num!==1) {
			setLog("emitVHD: Assigned value '"+numStr+"' expected 0 or 1!");
		}
		if (num%2===0) {return "'0'";}
		return "'1'";
	}
	
	if (outFormat==="b" || (outFormat==="" && size <= setup.maxBinSize)) { // output string literal
		return bitString(num, size);
	} else {
		if (unsigned) { return "to_unsigned("+num+", "+size+")"; }
		return "to_signed("+num+", "+size+")";
	}
 }


let Resource={IO:0, FF:1, BOOL:2, ARIT:3, CMP:4, MUX:5, IOID:6};

function Process() {    // process data
	let sensitivity = new Set([]);
	
	function initList(o) {sensitivity=new Set([]);}
	function addVar(o) {sensitivity.add(o);}
	function sensList() {
		return Array.from(sensitivity).join(',')
	}
	return {initList, addVar, sensList};
}
process = new Process();
	
function Stat() {    // statistics and tmp values
	let numIO = 0;
	let numFF = 0;
	let numBool = 0;
	let numArit = 0;
	let numCmp = 0;
	let numMux = 0;
	let io = new Set([]); // I/O variables
	let ff = new Set([]);
	let names = new Set([]); // set of variable names
	let pos = {x:0, y:0}; // model visit position
	
	let blockLevel;
	let blockArray;
	
	function init() {
		numIO = 0;
		numFF = 0;
		numBool = 0;
		numArit = 0;
		numCmp = 0;
		numMux = 0;
		io = new Set([]);
		ff = new Set([]);
		
		blockLevel = 0;
		blockArray = [0, 0];		
	}
	
	function initNames() {names = new Set([]);}
	function addName(o) {names.add(o);}
	function getNames(o) {return names;}
	
	function blockName() {
		let str = (blockArray[0]+1);
		let i;
		for (i=1; i<=blockLevel; i+=1) {
			str += "."+(blockArray[i]+1);
		}		
		return str;
	}
	function pushBlock() {
		blockLevel += 1;		
		if (blockArray[blockLevel]===undefined) {blockArray[blockLevel]=0;}
	}
	function popBlock() { // check if 0!!
		if (blockLevel>0) {
			blockArray[blockLevel] += 1;
			blockArray[blockLevel+1] = 0;
			blockLevel -= 1;
		}
	}
	
	function setPos(p) { pos = p; }
	function getPos() { return pos;}
	
	function addID(id, set) { // add identifier to set
		if (set===Resource.IO) {io.add(id);}
		if (set===Resource.FF) {ff.add(id);}
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
	
	return {init, initNames, addName, getNames, blockName, pushBlock, popBlock, setPos, getPos, addID, getSet, incNum, emit};
}

stat = new Stat(); // global status object, resource statistics and global tmp values


function NumConst(n, fmt) { "use strict";
	let num = 0;
	let value = [0, 0];
	let obj = {unsigned:true, size:0, format:fmt};
	
	if (n[0]==="-") {  // TODO: unary not constant
		num = Number(n.slice(1));
		const tmp = vec.op("-", vec.zero, [num, 0]);
		value = [tmp[0], tmp[1]];
		obj.size = num.toString(2).length+1;
		obj.unsigned = false;	
		if (logval) {console.log("NumConst negative!");}
	} else {
		num = Number(n);
		value = [num, 0];
		
		if (obj.format===undefined) {obj.format="";}
		if (obj.format[0]==="b") { // TODO: hex constant size
			obj.size = Number(obj.format.slice(1));
		} else {
			obj.size = num.toString(2).length;
		}
				
		if (logval) {console.log("NumConst "+obj.size+" fmt:"+obj.format);}
	}

	function set(o) {  // set number type: signed/unsigned and compute size
		let log ="";
	
		if (o.hasOwnProperty("type")) {	
			if (o.type.hasOwnProperty("unsigned")) {
				obj.type.unsigned = o.type.unsigned;
				if (o.type.unsigned) {obj.size = vec.out(value).toString(2).length;}
				else {obj.size = vec.out(value).toString(2).length+1;}
				log+=" type:"+typeToString(o.type);
			}
		}	
		
		if (logset) {console.log("num.set "+log);}
	}	
	
	function val() {return value;}
		
	function get() {
		return {type: {id:"num", unsigned:obj.unsigned, size:obj.size, format:obj.format}};
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
	 
	return {val, get, set, visit, emitVHD, count};
}

// add slice mode: 0 - range, 1 - variable index
function Slice(v) {
	let variable = v;
	let mode = 0; // -1 for index mode or high index
	let low = 0;  
	let size = 1;
	let mask = Object.assign({}, vec.mask(1));
	let index = null;
	
	function sliceSetup(m, n) { // range(m...n) 
		if (m===-1) { // new: -1 = variable index
			mode = -1;
			size = 1; 
		    if (type(variable).array>1) { // variable is array !
				size = Number(type(variable).array);
			}			
			index = n;
		} else {		
			mode = Number(m);
			low = Number(n);
			size = mode-low+1;
			mask = Object.assign({}, vec.mask(mode-low+1));
		}
	}
	
	function val() {
		let b = low;
		
		if (mode===-1) { // get one bit, TODO: check out of range
			b = index.val()[0];
			console.log("Index: "+b);			
		}
		let v = vec.shiftRight(variable.val(), b);
		console.log("Vector [0]: "+v[0]);
		v[0] &= mask[0];
		v[1] &= mask[1];
	
		return v;		
	} 
	
	//function setVal(v) {}  not applicable, slice is used only on expression right 

	function get() { // pass the variable info, isVar=false
		let v = variable.get();
		let type = Object.assign({}, v.type);		
		let hdl = Object.assign({}, v.hdl);
		
		type.size = size;
		if (size===1) {type.id="bit";}
		
		const o = {isVar:false, name:v.name, mode:v.mode, type:type, hdl:hdl};
		return o;
	}
	
	function set(o) {  // apply set to the variable, except size	
		variable.set(o);
	}
	
	function visit() {
		stat.addName(variable.get().name);
		if (mode===-1) {return variable.get().name+"("+index.get().name+")";}
		
		if (mode===low) {return variable.get().name+"("+mode+")";}
		
		return variable.get().name+"("+mode+":"+low+")";
	}
	
	function emitVHD() {
		stat.addName(variable.get().name);//12.3.
		if (mode===-1) {return variable.get().name+"(to_integer("+index.get().name+"))";}
		if (mode===low) {return variable.get().name+"("+mode+")";}
		return variable.get().name+"("+mode+" downto "+low+")";
	}
	
	function count() {return 1;}
	
	return {val, get, set, sliceSetup, visit, emitVHD, count};
}

function Var(s) { "use strict";
 let obj = {isVar:true, name:s, mode:"", type:{id:"sig", unsigned:true, size:0, declared:0}, mask:[0, 0], hdl:{}}; // target:"" or "=" numtarget:0, 1, 
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
//console.log("set size: "+obj.type.size+"S"+(value[0]&(1 <<(obj.type.size-1))));
		if ((value[0]&(1 <<(obj.type.size-1)))!==0) {
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
		if (o.type.hasOwnProperty("unsigned")) {obj.type.unsigned = o.type.unsigned; log+=" u:"+o.type.unsigned;}
		if (o.type.hasOwnProperty("size")) {  // set size, compute type id and mask 
			obj.type.size = o.type.size; 
			if (o.type.size===1) {obj.type.id="bit";}			
		    Object.assign(obj.mask, vec.mask(obj.type.size));	
			log+=" size:"+o.type.size;
		}
		if (o.type.hasOwnProperty("declared")) {obj.type.declared = o.type.declared; log+=" dec:"+o.type.declared;}		
		if (o.type.hasOwnProperty("array")) {obj.type.array = o.type.array; log+=" array:"+o.type.array;}	
		if (o.type.hasOwnProperty("def")) {obj.type.def = o.type.def; log+=" def";}
		if (logset) {console.log("Var.set type "+log);}
	}
	
	if (o.hasOwnProperty("hdl")) {
		if (o.hdl.hasOwnProperty("mode")) {obj.hdl.mode = o.hdl.mode; log+=" mode:"+o.hdl.mode;}
		if (o.hdl.hasOwnProperty("assignments")) {obj.hdl.assignments = o.hdl.assignments; log+=" a:"+o.hdl.assignments;}
		if (o.hdl.hasOwnProperty("assignop")) {obj.hdl.assignop = o.hdl.assignop; log+=" op"+o.hdl.assignop;}
		if (o.hdl.hasOwnProperty("val")) {obj.hdl.val = o.hdl.val; log+=" v="+o.hdl.val;}		
		if (o.hdl.hasOwnProperty("names")) {obj.hdl.names = o.hdl.names; log+=" names="+o.hdl.names.size;}
		if (logset) {console.log("Var.set hdl "+log);}
	}
 }
 
 function setNext(n) { // if masked input != value, set nextValue & return true
	if (!(Array.isArray(n) && n.length===2)) {
		console.log("Var.setNext "+obj.name+" param error");		
		console.log(n);
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
	 stat.addName(obj.name);
	 return obj.name;
 }
 function emitVHD() {
	 stat.addName(obj.name);
	 return obj.name;
}
 function count() {return 1;}

 return {get, set, val, setVal, setNext, next, visit, emitVHD, count};
} // Var

// obj {left:null, op:"", right:null, type:{}}
function Op(o, optType) { "use strict";
 let obj = o; 
 obj.type = optType===undefined ? {id:"", unsigned:true, size:0, format:""} : optType;
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
		if (o.type.hasOwnProperty("format")) {obj.type.format = o.type.format; log+=" f:"+o.type.format;}
		if (o.type.hasOwnProperty("bool")) {obj.type.bool = o.type.bool; log+=" b:"+o.type.bool;}
	    if (logset) {console.log("Op.set "+obj.op+" type "+log);}
	}
 }
 
 function val() {	 	
	if (obj.op==="") {return obj.left.val();}
	if (obj.left===null) {
	  return vec.unary(obj.op, obj.right.val());
	}
	if (isComparisonOp(obj.op)) {
		const max = Math.max(type(obj.left).size, type(obj.right).size);
		const cmpType = {size:max, unsigned:type(obj.left).unsigned};
//console.log("Op.val Comparison size="+max);
		return vec.cmp(obj.op, obj.left.val(), obj.right.val(), cmpType);
	}
	if (obj.op===",") {
		return vec.concat(obj.left.val(), obj.right.val(), type(obj.right).size);
	}
	return vec.op(obj.op, obj.left.val(), obj.right.val());
 } 
		
 function visit(statistics) { // visit op tree, set op id & return description string
	let str = "";
	let id2 = ""; // right (second) operand id
	let no = 0;   // num of operands

//console.log("BEGIN Op.Visit: "+obj.op+" type: '"+obj.type.id+"' "+obj.type.size+" "+obj.type.unsigned);	
	if (obj.op==="") {	// only one operand
		str=" ";
		if (obj.left!==null) {
			str += obj.left.visit(statistics); 
			no += obj.left.count();
			obj.type.id = type(obj.left).id;
		}
	} else { // operator and operands
		if (isComparisonOp(obj.op)) { // test comparison
//console.log("cmp.visit1 '"+obj.op+"'");				
			if (obj.left===null || obj.right===null) {
				console.log("op.visit: Unexpected empty comparison!");
			} else {				
				// check if compare sig of same type and different size or sign
				if (type(obj.left).id === "sig" && type(obj.right).id === "sig") {
//console.log("cmp.visit2 "+type(obj.left).size+" r:"+type(obj.right).size);
					if (type(obj.left).size !== type(obj.right).size) {  // illegal diff size
						throw modelErr("cmpsz", "", stat.getPos());
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
			obj.type.id = type(obj.left).id;  // get ID from left
		}
		str += " "+obj.op+" ";
		if (obj.right!==null) { // visit right
			str += obj.right.visit(statistics); 
			no += obj.right.count();
			id2 = type(obj.right).id;
			if (obj.type.id==="") { // get ID from right
				obj.type.id = id2;
			} else { // get ID from both				
				if (obj.type.id!==id2) { // (x,sig)->sig else (x,bit)->bit else ->num
					if (id2==="sig") {obj.type.id = "sig";}
					else if (id2==="bit") {
						if (obj.type.id==="bit" || obj.type.id==="num") {obj.type.id = "bit";}
					} else if (id2==="num") {
						obj.type.id = obj.type.id;
					} else {console.log("Op.visit unexpected type id! "+id2);}
				}
			/*	if (obj.op===",") {obj.type.id = "sig";} // TODO: check NUM*/
				if (isComparisonOp(obj.op)) {obj.type.id = "bit";} // Compare is allways type: bit
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
console.log("END Op.Visit: "+obj.op+" type: '"+obj.type.id+"' "+obj.type.size+" "+obj.type.unsigned+" num"+no);
	return str;
 }

 function resizeExp(expstr, newsize, oldsize) { // resize expression
    if (newsize === oldsize) return expstr;
	if (Number(oldsize)===1) {
		return "(0 => "+expstr+", others => '0')"; // (( začasno, da ne pobriše)) TODO
	} else if (Number(newsize)===1) {
		return "("+expstr+")(0)";
	}
	return "resize("+expstr+", "+newsize+")";
	 
 }
 
 function resizeVar(str, newsize, oldsize) {  // resize sig or bit
    if (newsize === oldsize) return str;
	if (Number(oldsize)===1) {
		return "(0 => "+str+", others => '0')"; // (( začasno, da ne pobriše)) TODO
	} else if (Number(newsize)===1) {
		return str+"(0)";
	}
	return "resize("+str+","+newsize+")";
 } 
 
 function sigSign(obj, unsigned) {   // convert sig to unsigned/signed
	if (unsigned && !type(obj).unsigned) {
		 return "unsigned("+obj.emitVHD()+")";
	} else if (!unsigned && type(obj).unsigned) {
		 return "signed("+obj.emitVHD()+")";
	}
	return obj.emitVHD();
 }
 
 function emitVHD() {
	let str = "";
	let numStr = "";
	let bitStr = "";
	let exp = "";
	let op = "";
	let lt = null;
	let rt = null;
	let num = 0;

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
			case ",": op = "&"; break;			
			default: console.log("on.emitVHD: unknown operation!");
		}		
				
		if (obj.left === null) { // unary op
			str = op+" "+obj.right.emitVHD();
			
		} else if ((obj.left!==null) && (obj.right!==null)) {  // binary op, get size & op	
		
			lt = type(obj.left);
			rt = type(obj.right);
console.log("Op.emit "+op+"("+obj.type.size+") left:"+lt.size+" r:"+rt.size);
 			if (isComparisonOp(obj.op)) { // handle comparison
				if ((lt.id==="bit") && (rt.id==="num")) {
					return "("+obj.left.emitVHD()+" "+op+" '"+obj.right.emitVHD()+"')";
				} else if ((lt.id==="num") && (rt.id==="bit")) {
					return "('"+obj.left.emitVHD()+"' "+op+" "+obj.right.emitVHD()+")";
				} else {
					return "("+obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD()+")";
				}
			} else {
console.log("!!! Op.emit "+op+" left:"+lt.id+lt.size+" r:"+rt.id+rt.size);				
				str = "(";
				if (lt.id==="num") {
					if (rt.id==="num") { // 1A
						return vec.out(val());  // return calculated value, TODO: check size !						
						} 
					if (rt.id==="bit") { // 1B			
						num = Number(obj.left.emitVHD());
						if (num!==0 && num!==1) {setLog("emitVHD: Expression number expected 0 or 1!");}
						if (num%2===0) {exp = "'0' "+op+" "+obj.right.emitVHD();}
						else {exp = "'1' "+op+" "+obj.right.emitVHD();}
						
						str += resizeVar(exp, obj.type.size, 1); // TODO: resie EXP, test!
						
					} else if (rt.id==="sig") { // 1C
						if (op==="&") {
							if (lt.size===1) { // single bit
								numStr = "'"+obj.left.emitVHD()+"'";
							} else {
								const numType = {size:type(obj.left).size, unsigned:obj.type.unsigned};
								numStr = numVHD(obj.left.emitVHD(), numType, "");								
							}
							exp = numStr+" "+op+" "+obj.right.emitVHD();
							if (lt.size+rt.size !== obj.type.size) {
								str += resizeVar(exp, obj.type.size, 2);
							} else {
								str += exp;
							}
						} else if (op==="+" || op==="-") {  // sig +/- num (numStr = integer)
							numStr = obj.left.emitVHD();
							if (obj.type.size === rt.size) {								
								str += numStr+" "+op+" "+obj.right.emitVHD();
							} else {  // resize only sig	
								str += numStr+" "+op+" resize("+obj.right.emitVHD()+","+(obj.type.size)+")";
							}
						} else if (op==="*") {
							str += obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
						} else {
							numStr = numVHD(obj.left.emitVHD(), obj.type, "");
							exp = numStr+" "+op+" "+obj.right.emitVHD();
							if (rt.size === obj.type.size) {
								str += numStr+" "+op+" "+obj.right.emitVHD();
							} else {
								str += numStr+" "+op+" resize("+obj.right.emitVHD()+", "+obj.type.size+")"
							}
						}
					} else {
						console.log("op.emitVHD 1");
					}
				} else if (lt.id==="bit") { 
					if (rt.id==="num") {  // 2A
						num = Number(obj.right.emitVHD());
						if (num!==0 && num!==1) {setLog("emitVHD: Expression number expected 0 or 1!");}
						if (num%2===0) {exp = obj.left.emitVHD()+" "+op+" '0'";}
						else {exp = obj.left.emitVHD()+" "+op+" '1'";}
					
						str += resizeVar(exp, obj.type.size, 1);
						
					} else if (rt.id==="bit") { // 2B
						exp = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
						if (op==="&") {
							if (lt.size+rt.size !== obj.type.size) {
								str += resizeVar(exp, obj.type.size, 2);
							} else {
								str += exp;
							}
						} else {						
							str += resizeVar(exp, obj.type.size, 1);
						}
					} else if (rt.id==="sig") { // 2C
						if (op==="&") {
							exp = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
							if (lt.size+rt.size !== obj.type.size) {
								str += resizeVar(exp, obj.type.size, 2);
							} else {
								str += exp;
							}
						} else {
							if (op==="+" || op==="-") { // special for arithmetic op
								if (rt.unsigned) {
									str +=  "unsigned'(\"\" & "+obj.left.emitVHD()+") "+op+" "+obj.right.emitVHD();
								} else {
									str +=  "signed'(\"\" & "+obj.left.emitVHD()+") "+op+" "+obj.right.emitVHD();
								}
							} else if (op==="*") { // special for arithmetic op	
								str += "(0 to "+(Number(rt.size)-1)+" => "+obj.left.emitVHD()+") and "+obj.right.emitVHD();

							} else { // use aggregate for signed & unsigned
								exp = "(0=>"+obj.left.emitVHD()+", ("+(Number(rt.size)-1)+" downto 1)=>'0') "+ 
								op+" "+obj.right.emitVHD();
							}
							
							if (rt.size === obj.type.size) {
								str += exp;
							} else {
							   str += resizeVar(exp, obj.type.size, 2);
							}
						}
					} else {
						console.log("op.emitVHD 2");
					}
				} else if (lt.id==="sig") {			
					if (rt.id==="num") {  // 3A check if operation is possible (+,-, or, ...)
						if (op==="&") {
							if (rt.size===1) { // single bit
								numStr = "'"+obj.right.emitVHD()+"'";
							} else {
								const numType = {size:type(obj.right).size, unsigned:obj.type.unsigned};
								numStr = numVHD(obj.right.emitVHD(), numType, "");
							}
							exp = obj.left.emitVHD()+" "+op+" "+numStr;
							if (lt.size+rt.size !== obj.type.size) {
								str += resizeVar(exp, obj.type.size, 2);
							} else {
								str += exp;
							}
						} else if (op==="+" || op==="-") {  // sig +/- num = integer
							numStr = obj.right.emitVHD();
							if (obj.type.size === lt.size) {
								str += obj.left.emitVHD()+" "+op+" "+numStr;
							} else {  // resize only sig
								str += "resize("+obj.left.emitVHD()+","+(obj.type.size)+") "+op+" "+numStr;
							}
						} else if (op==="*") {  // sig +/- num = integer
							str += obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
						} else {
							numStr = numVHD(obj.right.emitVHD(), obj.type, "");														
							if (obj.type.size === lt.size) { 
								str += obj.left.emitVHD()+" "+op+" "+numStr;
							} else {
								str += "resize("+obj.left.emitVHD()+", "+obj.type.size+") "+op+" "+numStr;								
							}
						}						
					} else if (rt.id==="bit") { // 3B  OK
						if (op==="&") {
							exp = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
							if (lt.size+rt.size !== obj.type.size) {
								str += resizeVar(exp, obj.type.size, 2);
							} else {
								str += exp;
							}
						} else if (op==="+" || op==="-") { // special for arithmetic op
							if (lt.unsigned) {
								bitStr = " unsigned'(\"\" & "+obj.right.emitVHD()+")";
							} else {
								bitStr = " signed'(\"\" & "+obj.right.emitVHD()+")";
							}
						
							if (lt.size === obj.type.size) {
								str += obj.left.emitVHD()+" "+op+bitStr;
							} else {
								str += resizeVar(obj.left.emitVHD(), obj.type.size, 2)+" "+op+bitStr;
							}
						} else if (op==="*") { // special for arithmetic op	
							str += obj.left.emitVHD()+" and (0 to "+(Number(lt.size)-1)+" => "+obj.right.emitVHD()+")";
						} else { // use aggregate for signed & unsigned
							exp = obj.left.emitVHD()+" "+op+" (0=>"+obj.right.emitVHD()+", ("+(Number(lt.size)-1)+" downto 1)=>'0')";

							if (lt.size === obj.type.size) {
								str += exp;
							} else {
								str += resizeVar(exp, obj.type.size, 2);
							}
						}
					} else if (rt.id==="sig") {  // 3C
						// check +/- for carry (resize one )
						if ((op==="+" || op==="-") && (obj.type.size > Math.max(lt.size, rt.size))) {
							str += resizeVar(obj.left.emitVHD(), obj.type.size, lt.size)+" "+op+" "+
								   resizeVar(obj.right.emitVHD(), obj.type.size, rt.size);
						} else if (op==="*") {
							str += resizeVar(obj.left.emitVHD()+op+obj.right.emitVHD(), obj.type.size, lt.size+rt.size);
						} else if (op==="&") {
							//exp = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
							exp = sigSign(obj.left,obj.type.unsigned)+" "+op+" "+
							      sigSign(obj.right,obj.type.unsigned);
console.log("Exp: "+exp+"L:"+lt.size+lt.unsigned+" R:"+rt.size+rt.unsigned+" Obj:"+obj.type.size);
							if (lt.size+rt.size !== obj.type.size) {
								str += resizeVar(exp, obj.type.size, 2);
							} else {
								str += exp;
							}

						} else {
console.log("sig-sig L-R:"+lt.size+"-"+rt.size+" obj"+obj.type.size);
							let tmpSize = lt.size;
							if (lt.size === rt.size) {  // resize operand ?
								exp = obj.left.emitVHD()+" "+op+" "+obj.right.emitVHD();
							} else if (lt.size < rt.size) {
								tmpSize = rt.size;
								exp = resizeVar(obj.left.emitVHD(), rt.size, lt.size)+" "+op+" "+obj.right.emitVHD();
							} else {
								exp += obj.left.emitVHD()+" "+op+" "+resizeVar(obj.right.emitVHD(), lt.size, rt.size);
							}
							
							if (tmpSize === obj.type.size) { 
								str += exp;
							} else {
								str += resizeExp(exp, obj.type.size, tmpSize); // 25.1. correct for 2 bits
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
console.log("%op: '"+str+"'");	
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
	let obj = {id: t, target: null, expr: null, ifBlock: null, elseBlock: null, translated: false, level:0, pos:{x:0, y:0}, elsif: 0};
		
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
		if (o.hasOwnProperty("elsif")) {obj.elsif = o.elsif; log+=" elsif:"+o.elsif;}
		if (o.hasOwnProperty("elsLink")) {obj.elsLink = o.elsLink; log+=" elsLink";}
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
	
	function val(firstCycle, numCycle) {
		let change = false;
		
		if (obj.id==="=" || (firstCycle && numCycle>0 && (obj.id==="<="))) { // AT 4.12.
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
					if (st.val(firstCycle, numCycle)) {change = true;}
				});
			} else if (obj.elseBlock!==null) { // else exists
			    if (logval) {console.log("St.val if "+obj.expr.visit()+": false");}
				obj.elseBlock.statements.forEach(function(st) {
					if (st.val(firstCycle, numCycle)) {change = true;}
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
					stat.initNames();
					str += obj.expr.visit();  // visit expression, count operands, set var mode = in
										
					let nameSet = new Set([]);
					if (obj.target.get().hdl.hasOwnProperty("names")) { // get existing names
						nameSet = obj.target.get().hdl.names;
					}
					for (const id of stat.getNames()) {
						setHdlMode(vars.get(id), "in"); // set HDL to IN
						nameSet.add(id);                // add ID to current name set						
					}
					
					obj.target.set({hdl: {names: nameSet}}); // add set of names to target					
				}
				
				if (type(obj.target).size !== type(obj.expr).size) {  // NOTE: Resize assignment, correct expr op
					if (isComparisonOp(obj.expr.getOp())) {
						if (log) {console.log("Statement.visit: size difference comparisson");}
					} else if (obj.expr.getOp()==="*"){
						if (log) {console.log("Statement.visit: size difference multiplication");}
					} else {
						if (log) {console.log("Statement.visit: size difference "+type(obj.target).size+" "+type(obj.expr).size);}
						obj.expr.set({type: {size: type(obj.target).size}});
					}
				}
				
			} else {  // second pass
				if (obj.expr.count()===1) {  // single assignment to num => constant
					if ((type(obj.expr).id==="num") && (hdl(obj.target).assignments===1) && (hdl(obj.target).assignop==="=")
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
				str += "<"+obj.elsif+">";
				stat.initNames();
				str += obj.expr.visit()+"\n";
				for (const id of stat.getNames()) {
					setHdlMode(vars.get(id), "in");
				}
				
				if (obj.expr.getOp()==="==") { // test var == num
					if (obj.expr.getLeft().get().isVar && type(obj.expr.getRight()).id==="num") {
						obj.conEqualId=obj.expr.getLeft().get().name;
					}
				}
				
				str += obj.ifBlock.visit(pass, vars);
				if (obj.elseBlock!==null) {  // visit else

					let st0 = obj.elseBlock.statements[0];
					if (st0!==undefined && st0.get().id==="if") {  // else if
						
						if (st0.get().elsif===1) {
//prestavil v elsif					
							let mainLink = obj.elsLink;
							if (mainLink===undefined) {st0.set({elsLink: obj});}
							else {st0.set({elsLink: mainLink});}
														
							obj.els = true; // NOVO
						}
					}
					str += "else " + obj.elseBlock.visit(pass, vars);				
				}
			} else if (pass===2) {
				str += obj.ifBlock.visit(pass, vars);
				if (obj.elseBlock!==null) {
					let st0 = obj.elseBlock.statements[0];
					if (st0!==undefined) {
						const obj=st0.get().elsLink;
						
						if (obj!==undefined && st0.get().id==="if") {
//console.log("PASS2: IF: "+st0.get().expr.visit(1)+" > "+st0.get().conEqualId+" < "+st0.get().elsLink.conEqualId);
							if (st0.get().elsLink.conEqualId!==undefined && st0.get().elsLink.conEqualId!=="") {
								if (st0.get().conEqualId === st0.get().elsLink.conEqualId) {
									if (obj.isCase!==false) {obj.isCase = true;} // if undefined | true								
								} else {
									obj.isCase = false;
								}
							}
							if (st0.get().elseBlock) { // statement has else block
								obj.isOthers = true;								
							} else {
								obj.isOthers = false;																
							}
						} 
					}						
					
					str += "else " + obj.elseBlock.visit(pass, vars);				
				}
				if (obj.isCase) {setLog("Opt: if transformed to case!");}
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
					
			stat.initNames(); //12.3.
			expStr = obj.expr.emitVHD();
			for (const id of stat.getNames()) { // 12.3.
						process.addVar(id);
			}
			
			let lsz = type(obj.target).size;
			let rsz = type(obj.expr).size;
console.log("St.emit left:"+lsz+" r:"+rsz);			
			if (obj.expr.count()===1) { // single item assignment (num, sig or bit)
				let v = null;
				if (obj.expr.getOp()==="") {
					v = obj.expr.getLeft();
				} else {
					v = obj.expr.getRight(); // TODO resolve unary op, unary - only for signed !!
				}
									
				if (type(v).id==="num") { // special code for number assignment
						const fmt=(type(v).format===undefined) ? "" : type(v).format[0];						
						str += numVHD(expStr, type(obj.target), fmt);
						// TODO: check signed value to unsigned target
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
				// 25.1. Check - do not slice ()
			} else { // expression assignment
				if (type(obj.expr).id==="num") { // special code for number assignment
						str += numVHD(expStr, type(obj.target), "d");						
				} else {					
					if (lsz!==rsz) { // TODO 1 bit !
						// if lsz = 1 not applicable
						if (rsz===1) {
							expStr = "((0 => "+expStr+", others => '0'))"; 
						} else {
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
//console.log("Slice ()"+str);
				if (str.slice(0,1)==="(" && str.slice(-1)===")") {str = str.slice(1, -1);}				
			}	

			str = spaces + obj.target.visit()+" <= "+str+";\n";
			
			//str += "\n";
		} else if (obj.id==="if") {  // if statement, check if belongs to comb
			stat.initNames(); //12.3.
			let condStr = obj.expr.emitVHD(); // get condition and strip spaces
			if (condStr.slice(0,1)==="(" && condStr.slice(-1)===")") {condStr = condStr.slice(1, -1);}
			for (const id of stat.getNames()) { // 12.3.
						process.addVar(id);
			}
		
			let doCase = obj.isCase || (obj.elsLink!==undefined && obj.elsLink.isCase) ? true : false;
console.log("Model: isCase:"+obj.isCase+" "+(obj.elsLink!==undefined && obj.elsLink.isCase));			
console.log("IFCS +cp="+obj.combProc+" +sp="+obj.seqProc);		
			if ((obj.combProc && isComb) || (obj.seqProc && !isComb)) {
				str = "";
				if (obj.elsif!==1) { // start new conditional statement
					if (obj.els && obj.isCase) { 
						str += spaces + "case "+obj.expr.getLeft().emitVHD()+" is\n";
						const bitSize = type(obj.expr.getLeft()).size;						
						let bv = bitString(obj.expr.getRight().emitVHD(), bitSize);						
						str += spaces + " when "+bv+" =>\n";
					} else { 						
						str += spaces + "if "+condStr+" then\n"; 						
					}
				} else {            // continue conditional (elsif or when)					
					if (doCase) {
						const bitSize = type(obj.expr.getLeft()).size;						
						let bv = bitString(obj.expr.getRight().emitVHD(), bitSize);						
						str += " when "+bv+" =>\n";
					} else {
						str += "if "+condStr+" then\n";
					}
				}

				// emit statements inside IF BLOCK
				let ifBodyStr="";
				obj.ifBlock.statements.forEach(function (st) {
					ifBodyStr += st.emitVHD(indent, isComb);
				});
				
				if (ifBodyStr==="") {str += spaces+"   null;\n";} // null statement
				else { str += ifBodyStr; }
				
				// TODO: check if else block exists and is required to emit
				
				if (obj.elseBlock!==null) { // transform else block								
					let elseKey="";
					let elseStr="";

					if (obj.els) { 
						if (doCase) { elseKey += spaces; } // ...+when
						else { elseKey += spaces+"els"; }  // ...+els+if
					} else {
						if (doCase && obj.elsif===1 && !obj.els) { elseKey+=spaces+" when others =>\n"; }
						else {elseKey += spaces+"else\n"; }
					}
					
					obj.elseBlock.statements.forEach(function(st) {
						elseStr += st.emitVHD(indent,  isComb);
					});
					
					// emit else only if not empty!
					if (elseStr!=="") {str += elseKey + elseStr;}
							
					//if (elseStr==="") {str += spaces+"   null;\n";} // null statement					
				}

				if (obj.elsif!==1) { // end if (case)
					if (doCase) {
						if (obj.isOthers===false) { str += spaces+" when others => null;\n";}
						str += spaces + "end case;\n";
					} else { str += spaces + "end if;\n"; }
				}
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
    //let str = "Blok("+obj.level+" c:"+obj.combCnt+" s:"+obj.seqCnt+"): \n";
	let str = "B"+obj.name+": \n";
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
//	str += "Blok end:"+" c:"+obj.combCnt+" s:"+obj.seqCnt+"): \n";
	return str;	
 }
	
 return {get, set, statements, targets, push, visit};
}