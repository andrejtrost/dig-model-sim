/*File: vhdl.js */
/*jshint esversion: 6 */

function makeBold(input) {
 const keywords=["library","use","all","entity","port","in","out","is","begin","end", "architecture","downto","of",
                 "signal","constant","process","if", "then", "else"];
 return input.replace(new RegExp('(\\b)(' + keywords.join('|') + ')(\\b)','ig'), '$1<b class="w3-text-indigo">$2</b>$3');
}

function makeColor(input) {	
 const keywords=["std_logic","signed","unsigned"];
 const functions=["rising_edge", "resize", "to_signed", "to_unsigned"];
 const tmp=input.replace(new RegExp('(\\b)(' + keywords.join('|') + ')(\\b)','ig'), '$1<span class="w3-text-purple">$2</span>$3');
 
 return tmp.replace(new RegExp('(\\b)(' + functions.join('|') + ')(\\b)','ig'), '$1<span class="w3-text-blue">$2</span>$3');
}

function range(sz) {
  return "(<span class='w3-text-deep-orange'>" + (sz-1) + "</span> " + "downto <span class='w3-text-deep-orange'>0</span>)";
}

function VHDLports() {
  if (model===undefined) {return;}
  setLog("VHDL"); 
  
  let s = "library <b class='w3-text-brown'>IEEE</b>;\n";
  s += "use <b class='w3-text-brown'>IEEE.std_logic_1164</b>.all;\n";
  s += "use <b class='w3-text-brown'>IEEE.numeric_std</b>.all;\n\n"; 		
  
  var comp_name = document.getElementById("comp_name").value;
  s += "entity" + " " + comp_name + " is\n"; 
  
  s += " port (\n";
  if (model.getSeq()) s += "   clk : in std_logic;\n";
  let first=true;
  
  model.vars.forEach(function (val, id) {
	var tip = "unsigned";
	var mod = mode(val); //val.getMode();
	if (mod==="in" || mod==="out") {
		if (type(val).unsigned===false) tip = "signed";
		if (type(val).size===1) {tip = "std_logic";}
			
		if (first) { first=false; }
		else {s += ";\n"; }
		s += "   "+ val.get().name + " " + ":" + " " + mode(val) + " " + tip;    	
		if (type(val).size>1) {
		  s += range(type(val).size); 
		}
	}
  });
  s += " );\n";  

  s += "end "+ comp_name +";\n";
  s += "\narchitecture RTL of" + " " + comp_name + " " + "is" + "\n";

  model.vars.forEach(function (val, id) {
	var tip = "unsigned";
	var mod = mode(val);
	if (mod==="") {		
		if (type(val).unsigned===false) tip = "signed";
		if (type(val).size===1) {tip = "std_logic";}
			
		if (hdl(val).mode === "const") {
			s += " constant "+ val.get().name + " " + ": " + tip;
		} else {
			s += " signal "+ val.get().name + " " + ": " + tip;
		}
		if (type(val).size>1) {
		  s += range(type(val).size);
		}
		if (hdl(val).mode === "const") {
			let conv = " := ";
			if (type(val).size === 1) { // single bit constant
				if (Number(hdl(val).val)%2 === 1) {conv += "'1'";}
				else {conv += "'0'";}
			} else {
				if (type(val).unsigned) {
					conv += "to_unsigned("+hdl(val).val+","+type(val).size+")";
				} else {
					conv += "to_signed("+hdl(val).val+","+type(val).size+")";			
				}
			}
			s += conv+";\n";
		} else {		
			s += ";\n";
		}
	}
  });
   
  return s;
}

function VHDLcomb(proc) {	
	let s ="";
	
	// write comb assignments in the first level block
	let b = model.getBlok();
	b.statements.forEach(function(st) {
		
		if (!st.get().translated) {
			if (st.get().id==="=") {				
				st.set({translated: true});
				s += st.emitVHD(0, true);
			} 
		}
	});
	
	if (proc) { // need comb process
		s +="\nprocess(all)\nbegin\n";
		b.statements.forEach(function(st) {
			if (!st.get().translated) {
				if (st.get().id==="if") {
					s += st.emitVHD(2, true);
				}
			}
		});

	
		s+= "end process\n";
	}
	
	
	return s;
}

function VHDLseq() {
	let s ="\nprocess(clk)\nbegin\n if rising_edge(clk) then\n";
	
	let b = model.getBlok();
	b.statements.forEach(function(st) {
		if (!st.get().translated) {			
			s += st.emitVHD(2, false);
		}
	});
	
	s += " end if;\nend process;\n";
	return s;
}

// traverse model tree, search and mark comb blocks
function searchComb(b, level) {  // traverse code block
	let combProc = false;

	b.statements.forEach(function(st) {
//console.log("TR "+level+" st:"+st.get().id+" "+combProc);
		  if (st.get().id==="if") {
			let b1 = st.getIf();
			if (b1.get().combCnt > 0) {combProc = true;}
			if (searchComb(b1, level+1)) {combProc = true;}			
//console.log("TR comb:"+combProc);		
			st.set({combProc: combProc});  // mark if statement !
//console.log("POP IF "+b1.get().combCnt+combProc);
		  }
	  });
	return combProc;
}

function searchSeq(b) {
	let seqProc = false;

	b.statements.forEach(function(st) {
		  if (st.get().id==="if") {
			let b1 = st.getIf();
			if (b1.get().seqCnt > 0) {seqProc = true;}
			if (searchSeq(b1)) {seqProc = true;}					
			st.set({seqProc: seqProc});  // mark if statement !
		  }
	  });
	return seqProc;
}

function VHDLout() {
	let combProc = false;
	if (model) {
	  // mark comb if statements
	  let b = model.getBlok();
	  combProc = searchComb(b, 0);
console.log("BLOK comb: "+combProc);	  
	  searchSeq(b);
			
	  model.visit(2); // visit, second pass
	  console.log("VHDL pass 2");
  	  model.vars.forEach(function(v) {	
			console.log(v.visit()+" val="+vec.out(v.val(), type(v).unsigned)+" mode="+mode(v)+" type="+typeToString(type(v))+
			" "+type(v).id+" hdl="+hdl(v).mode+" "+hdl(v).val);
	  });	 
	  
	} else {
		return;
	}
	
	let s = VHDLports();
	
	// deklaracije
	s += "begin\n";
	if (model) {s += VHDLcomb(combProc);}
	
	if (model.getSeq()) {s += VHDLseq();}
	
	s += "\nend RTL;";
	document.getElementById("vhdllog").innerHTML = makeColor(makeBold(s));
}