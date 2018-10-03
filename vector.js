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
  
  function hex(h) {
	if (h[1]===0) {
		return "0X"+(h[0] >>> 0).toString(16);
	} else {
		const low = (h[0] >>> 0).toString(16);
        return "0X"+(h[1] >>> 0).toString(16)+"_"+("0".repeat(8 - low.length)) + low;
	}
  }

  function parse(str) { // string to vector
	let n = parseInt(str);
	
	if (n <= maxN) {return [n, 0];}
	return [n % (maxN+1),  Math.floor(n / (maxN+1))];
  }
  
  // string (number) representation of vector
  //  if < 32 bit, return decimal number, else return hex due to JS loss of precision
  function out(o, unsigned) {
	if (unsigned) {
		if (o[1]===0) {return o[0].toString();}
		return hex(o);
	} else {
		if (o[1]===0) {return o[0].toString();}
		if (o[1]===0xFFFFFFFF) { // neg, <= 32 bit
		    const n = o[0] >> 0; // to signed integer
			return n.toString();
		}		
		return hex(o);
	}
  }
  
  function complement(c) {
	const a = [~c[0], ~c[1]];
	
	return op("+",a, [1,0]);
  }
  
  function mask(n) {
	let i = 1;
	let index = 0;
	let m = [1, 0]; // mask seed for n<=32

	if (n>32) {
		m = [0xFFFFFFFF, 1]; 
		index = 1;
		n -= 32;
	}

	while (i < n) {
		m[index] += (1 << i);
		i += 1;
	} 
	
	return m;
  }
	
  function add(a,b) { // compute sum, convert to int32
	let r = [0, 0];

	r[0] = a[0] + b[0];
	if (r[0] > maxN) {
		r[1] = (a[1] + b[1] + 1) >>> 0;
		r[0] >>>= 0;  // to Uint32
	} else {
		r[1] = (a[1] + b[1]) >>> 0;
	}		
	if (veclog) {console.log("add res="+vec.hex(r));}
    return r;  
  }
  
  function sub(a,b) {
	 let r = [0, 0];
	 r[0] = a[0] - b[0];
	 
	 if (r[0]<0) {
		r[1] = (a[1] - b[1] - 1) >>> 0;		
		r[0] >>>= 0;  //obj[0] += (maxN+1);  
	 } else {
		 r[1] = (a[1] - b[1]) >>> 0;
	 }
	 if (veclog) {console.log("sub res="+vec.hex(r));}
	 return r;
  }
  
  function mul(m1, m2) { // unsigned multiply, limit: 32 bit inputs!
	let result = [0,0];
	let tmp = 0;

	let mult1 = {...m1};
	let mult2 = {...m2};
	let unsigned = true;
//console.log("Mult low: "+mult1[0]+" * "+mult2[0]);

	if (m1[1] & 0x80000000 !== 0) {	// complement negative value
		mult1 = add([~m1[0], ~m1[1]], [1,0]);    //op("+",[~m1[0], ~m1[1]], [1,0]);
		unsigned = !unsigned;
	}	

	if (m2[1] & 0x80000000 !== 0) {
		mult2 = add([~m2[0], ~m2[1]], [1,0]); //op("+",[~m2[0], ~m2[1]], [1,0]); // = complement(m2);
		unsigned = !unsigned;
	}
//console.log("Mult low: "+mult1[0]+" * "+mult2[0]);	

	if (mult1[1]===0 && mult2[1]===0) {
		if (mult1[0]<=65535 || mult2[0]<=65535) { // one operand < 16 bit, OK			
			tmp = mult1[0]*mult2[0];			
			if (tmp > maxN) {
				result[1] = Math.floor(tmp / (2**32)); 
				result[0] = tmp % (2**32); 
			} else {
				result[0] = tmp;
			}
		} else { // divide b into 16 bit chunks, compute partial product b1, b2
			let b1 = mult1[0] * (mult2[0] & 0xFFFF);
			let b2 = mult1[0] * (mult2[0] >> 16); // 48-bit

			let t1 = [(b1 & 0xFFFFFFFF)>>>0, Math.floor(b1 / 2**32)];
			let t2 = [((b2 & 0xFFFF)<<16)>>>0, Math.floor(b2 / 2**16)];
			result = add(t1, t2); //  op("+",t1,t2);
		}
		
	} else {
	 if (veclog) {console.log("mul input > 32 bit");}		
	}
	
	if (!unsigned) { // add multiply sign
		result = complement(result);
	}
	
	return result;
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
  
  function op(operation, leftOp, rightOp) {
	const left = {...leftOp};   //[l[0], l[1]];  
	const right = {...rightOp}; //[r[0], r[1]];  
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
	  let res = [0,0];
	  
	  if (left[1] === right[1]) {
		if (left[0] === right[0]) {eq = true;}
		else if (left[0] > right[0]) {gt = true;}  // unsigned
		else {ls = true;}
	  } else {
		if (left[1] > right[1]) {gt = true;}
		else {ls = true;}
	  }
	  
	  switch (op) {
		case "==": res = eq ? [1,0]:[0,0]; break;
		case "!=": res = !eq ? [1,0]:[0,0]; break;
		case ">": res = gt ? [1,0]:[0,0]; break;
		case ">=": res = gt|eq ? [1,0]:[0,0]; break;
		case "<": res = ls ? [1,0]:[0,0]; break;
		case "<=": res = ls|eq ? [1,0]:[0,0]; break;
		default: res = [0,0];
	  }

	  if (veclog) {console.log("Vector cmp "+left+" "+op+" "+right+": "+res);}
	  return res;
  }
  
  return {zero, isZero, parse, out, hex, mask, op, unary, cmp, complement};
}