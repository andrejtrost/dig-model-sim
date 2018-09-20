/*File: lexer.js */
/*jshint esversion: 6 */
function isIDStart(ch) {
 return (ch === "_") || (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

function isIDchar(ch) {
	return (ch === "_") || (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || 
	       ((ch >= "0") && (ch <= "9"));
}

function isDigit(ch) {
	return (ch >= "0" && ch <= "9");
}

function isComparisonOp (s) {
	return s.match(/^(>|<|==|>=|<=|!=)$/);
}

function Token(tokenName, tokenType, position) {
 const id = tokenName;
 const type = tokenType;
 const xy = position;

 function isID() {return (type==="id");}
 function isNum() {return (type==="num");} 
 function isAssign() {return (type==="=");} 
 function isOp() {return (type==="op");}
 
 function isSeparator(){return (type==="\n") || (type===";") || (type==="\t");}
 //function isEnd() {return (type==="") || (type==="\n") || (type===";");}
 function isEOF() {return (type==="");}
 function isComparison() {return (type==="co");}
 
 function emit() {return "("+id+"."+type+" "+xy.y+":"+xy.x+")";}
 function pos() {
	return xy.y+":"+xy.x;
 }

// console.log("Token: '"+id+"' "+position.y+","+position.x); 
 
 return {id, isID, isNum, isAssign, isOp, isSeparator, isEOF, isComparison, emit, pos};
}


function Lexer(txt) {
	const str = txt;
	const len = txt.length;
	let nextCh = ((len > 0) ? str.charAt(0) : "");
	let index = 0;
	let pos = {x:0, y:0};
	let token = new Token("", "", pos);
	let look = new Token("", "", pos);

	function getCh() {
		let c = nextCh;
		index += 1;
		if (index < len) {
			nextCh = str.charAt(index);
			pos.x += 1;
		} else {
			nextCh = "";
		}
		return c;
	}
	
	function peekCh() {
		let i = index + 1;
		if (i < len) { return str.charAt(i); }
		else { return ""; }
	}

	function scan() {	
		let z;
		const pos0 = Object.assign({}, pos);
        //console.log("Pos0: "+pos0.y+","+pos0.x);		
		
		token = look;
		if (index>=len) { // end of source
		    look = new Token("e", "", pos0);
			return;
		}
		
		 // create(pos);
		
		if (isDigit(nextCh)) {			
			z = getCh();			
			while (isDigit(nextCh)) {z += getCh();}
			look = new Token(z, "num", pos0);
		} else if (isIDStart(nextCh)) {
			z = getCh();
			while (isIDchar(nextCh)) {z += getCh();}			
			switch (z) {
				case "and": look = new Token("&", "?", pos0); break;
				case "or":  look = new Token("|", "?", pos0); break;
				case "not":  look = new Token("~", "?", pos0); break;
				case "xor": look = new Token("^", "?", pos0); break;
				case "if": look = new Token("if", "if", pos0); break;
				case "else": look = new Token("else", "else", pos0); break;
				default: look = new Token(z, "id", pos0);
			}			
			
		} else {
			if (nextCh==="\n") {				
				getCh(); // read new line
				look = new Token("n", "\n",pos); 				
				pos.y+=1; pos.x=0;
			}
			else { // operators
				if (nextCh==="=") {
					if (peekCh()==="=") {						
						look = new Token("==", "co", pos);
						getCh(); getCh();
					} else {
						look = new Token("=", "=", pos);
						getCh();
					}
				} else if (nextCh===";") {
					look = new Token(";", ";", pos);
					getCh();
					
				} else if (nextCh==="<") {
					if (peekCh()==="=") {
						look = new Token("<=", "=", pos);
						getCh(); getCh();
					} else {
						look = new Token("<", "co", pos);
						getCh();
					}
				} else if (nextCh===">") {
					if (peekCh()==="=") {
						look = new Token(">=", "co", pos);
						getCh(); getCh();
					} else {
						look = new Token(">", "co", pos);
						getCh();
					}
				} else if (nextCh==="!") {
					if (peekCh()==="=") {
						look = new Token("!=", "co", pos);
						getCh(); getCh();
					} else {
						look = new Token("!", "?", pos);
						getCh();
					}		
				} else if (nextCh==="&") {
					if (peekCh()==="&") {
						look = new Token("&&", "bo", pos);
						getCh(); getCh();
					} else {
						look = new Token("&", "?", pos);
						getCh();
					}
				} else if (nextCh==="|") {
					if (peekCh()==="|") {
						look = new Token("||", "bo", pos);
						getCh(); getCh();
					} else {
						look = new Token("|", "?", pos);
						getCh();
					}					
				} else if (nextCh==="+" || nextCh==="-" || nextCh==="*") {
					look = new Token(nextCh, "op", pos);
					getCh();
				} else if (nextCh==="{" || nextCh==="}") {
					look = new Token(nextCh, "()", pos);
					getCh();					
			    } else { // vse ostalo
					look = new Token(nextCh, "?", pos);
					getCh();					
				}  
			}			
		}
		
		if (index>=len) {return;}
		if (nextCh===" " || nextCh==="\t") {
			while (nextCh===" " || nextCh==="\t") {getCh();}
		}
	}
	
	function peek() {
		//console.log("peek: "+token.emit());
		return look;}
	
	function consume() {
		scan();
		return token;
	}	

	scan();
	return {peek, consume};
}