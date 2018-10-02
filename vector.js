/*File: vector.js, define 2x32 bit signed/unsigned vector and operations */
/*jshint esversion: 6 */
/*jslint bitwise: true */
const maxN = 4294967295; 
const veclog = true;

function Vector() { // storage Array obj: 1:MSB, 0:LSB
  const zero = [0, 0];
  const one = [1, 0];
  let obj = [0, 0];

  function isZero(v) {
	  return v[1]===0 && v[0]===0;
  }
  
  function hex(h) {return h[1].toString(16)+"_"+h[0].toString(16);}

  function parse(str) { // string to vector
	let n = parseInt(str);
	
	if (n <= maxN) {return [n, 0];}
	return [n % (maxN+1), n / (maxN+1)];
  }
  
  function out(o, unsigned) { // vector to string, TODO > 32 bit
	if (unsigned) {
		if (o[1]===0) {return o[0].toString();}
		return (o[1]*4294967296 + o[0]).toString();
	} else {
		if (o[1]===0) {return o[0].toString();}
		if (o[1]===0xFFFFFFFF) {return o[0].toString();}
		return "???";
	}
  }
  
  function mask(n) {
	let i = 1;
	let j = 0;

	if (n<=32) {
		obj = [1, 0];
		j = 0;
	} else {
		obj = [0xFFFFFFFF, 1]; 
		j = 1;
		n -= 32;
	}

	while (i<n) {
		obj[j] += (1 << i);
		i += 1;
	} 
	
	//if (veclog) {console.log("Mask: "+n+"="+vec.hex(obj));}
	return obj;
  }
	
  function add(a,b) { // compute sum, convert to int32
	obj[0] = a[0] + b[0];
	if (obj[0] > maxN) {
		obj[1] = (a[1] + b[1] + 1) >>> 0;
		obj[0] >>>= 0;  // to Uint32
	} else {
		obj[1] = (a[1] + b[1]) >>> 0;
	}		
	if (veclog) {console.log("add res="+vec.hex(obj));}
    return obj;
  }
  
  function sub(a,b) {
	 obj[0] = a[0] - b[0];
	 
	 if (obj[0]<0) {
		obj[1] = (a[1] - b[1] - 1) >>> 0;		
		obj[0] >>>= 0;  //obj[0] += (maxN+1);  
	 } else {
		 obj[1] = (a[1] - b[1]) >>> 0;
	 }
	 if (veclog) {console.log("sub res="+vec.hex(obj));}
	 return obj;
  }
  
  function mul(a, b) { // unsigned multiply, limit: 32 bit inputs!
	let r = zero;
	let tmp = 0;
	
	if (a[1]===0 && b[1]===0) {
		if (a[0]<=65535 || b[0]<=65535) { // one operand < 16 bit, OK		
			tmp = a[0]*b[0];			
			if (tmp > maxN) {
				r[1] = Math.floor(tmp / (2**32)); 
				r[0] = tmp % (2**32); 
			} else {
				r[0] = tmp;
			}
		} else { // TODO: divide b into 16 bit chunks
			tmp = a[0]*b[0];			
			if (tmp > maxN) {
				r[1] = Math.floor(tmp / (2**32)); 
				r[0] = tmp % (2**32); 
			} else {
				r[0] = tmp;
			}		
			if (veclog) {console.log("32 bit multiplication with loss of data...");}
		}
		
	} else {
	 if (veclog) {console.log("mul input > 32 bit");}		
	}
	
	return r;
  }
  
  function and(a, b) {return a.map((a,i) => a & b[i]);}
  function or(a, b) {return a.map((a,i) => a | b[i]);}
  function xor(a, b) {return a.map((a,i) => a ^ b[i]);}
  function not(a) {return a.map(a => (~a));} // ? >>>0
  
  function unary(operation, x) {
	if (operation==="-") {return sub(zero, x);}
	if (operation==="~") {return not(x);}
	if (veclog) {console.log("ERR in Vector: unknown unary op!");}
  }
  
  function op(operation, left, right) {
	switch (operation) {
		case "+": return add(left, right);
		case "-": return sub(left, right);
		case "*": return mul(left, right);
		case "&": 
		case "&&":return and(left, right);
		case "|": 
		case "||":return or(left, right);
		case "^": return xor(left, right);
		default: {
			if (veclog) {console.log("ERR in Vector op!");}
			return zero;
		}
	} 
  }
  
  function cmp(op, left, right) {
	  let eq = false;
	  let gt = false;
	  let ls = false;
	  let res = zero;
	  
	  if (left[1] === right[1]) {
		if (left[0] === right[0]) {eq = true;}
		else if (left[0] > right[0]) {gt = true;}  // unsigned
		else {ls = true;}
	  } else {
		if (left[1] > right[1]) {gt = true;}
		else {ls = true;}
	  }
	  
	  switch (op) {
		case "==": res = eq ? one:zero; break;
		case "!=": res = !eq ? one:zero; break;
		case ">": res = gt ? one:zero; break;
		case ">=": res = gt|eq ? one:zero; break;
		case "<": res = ls ? one:zero; break;
		case "<=": res = ls|eq ? one:zero; break;
		default: res = zero;
	  }

	  if (veclog) {console.log("Vector cmp "+left+" "+op+" "+right+": "+res);}
	  return res;
  }
  
  return {zero, isZero, parse, out, hex, mask, op, unary, cmp};
}