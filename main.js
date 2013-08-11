/*
 * 	Credits: 	PEG for parser generator
 *				"alibaba/nquery" for great example script
 *	TODO: 	bracket highlight
 *		automatic bitset deduction(convert to hex and count char*nibble[4])
 *		sym names and bit markings(e.g. u32:rand_val)
 *		automatic sym bits/bytes grouping depending on the effect of op on certain bits/bytes
 *		implement shift operation highliting
 *	bitset:
 *		(a) integer
 *		(b) array of bits
 *		(c) bit size (bitarray.length) kept for brevity
 *		(d) array of bits changed
 */
var g_nibble_size = 4; // bits per nibble(=1 hex char)

// Client Variables
	// CLIENT OPTIONS
	// 		1; use only hex
	//		2; choose endianess
var endianness_enum = {
	le : 0,
	be : 1
};
var gcvar_endianness = endianness_enum.be;
// if false -> values are always hex despite prefix/suffix
// if true -> depends on prefix/sufix
var gcvar_use_only_hex = 0;
 
// note: this should use bitwise operators
// 	 but js uses hacks so it does not work
//       properly
function _int_to_bin(n)
{
	return (n >>> 0).toString(2);
}

function count_num_bits(n)
{
	return _int_to_bin(n).length;
}

function int_to_hex(n)
{
	return (n >>> 0).toString(16);
}

function int_to_bin(integer, bitsize)
{
	var bstring;
	var barray;

	bstring = _int_to_bin(integer);
	barray = bstring.split("");
	
	// string->array conv messes up
	barray.reverse();
	// zero-pad to bitsize
	for (i = barray.length; i < bitsize; i++) {
		barray.push(0);
	}
	// the default is little-endianness
	if (gcvar_endianness == endianness_enum.be) {
		// reverse the barray
		barray.reverse();
	}
	return barray;
}

function deduce_bitsize(n)
{
	var str;
	var bsize;
	
	str = n.toString(16);
	bsize = str.length * g_nibble_size;
	return bsize;
}

function Bitset(integer, bitsize, token_info) 
{
	this.integer = integer;
	this.bitsize = bitsize;
	this.token = token_info.token;
	this.left = token_info.left;
	this.right = token_info.right;
	// make bit array out of supplied info
	this.barray = int_to_bin(integer, this.bitsize);
	return this;
}

function bitset_two_compare(result, left)
{
	var i;
	var colorset = new Array();
	// TODO: handle mismatched bitlengths
	for (i = 0; i < result.length; i++) {
		if (result[i] == left[i]) {
			colorset.push("box-white");
		} else {
			colorset.push("box-yellow");
		}
	}
	return colorset;
}

function bitset_tri_compare(result, left, right)
{
	var i;
	var colorset = new Array();
	// TODO: handle mismatched bitlengths
	for (i = 0; i < result.length; i++) {
		if (result[i] == left[i] && result[i] == right[i]) {
			// unchanged
			colorset.push("box-white");
		} else if (result[i] == left[i] && result[i] != right[i]) {
			// left change
			colorset.push("box-red");
		} else if (result[i] != left[i] && result[i] == right[i]) {
			// right change
			colorset.push("box-blue");
		} else {
			// new bits
			colorset.push("box-yellow");
		}
	}
	return colorset;
}

function generate_div_bitset(out_div, barray, color)
{
	var div;
	var i;
	var div_spacing;
	var div_row;
	
	if (color == null) {
		color = "";
	}
	
	div = document.createElement('div');
	div.setAttribute('class', "bits-box");
	div_row = document.createElement('div');
	div_row.setAttribute('class', "bits-box-row");
	if (color instanceof Array) {
		for (i = 0; i < barray.length; i++) {
			div_spacing = document.createElement('div');
			div_spacing.setAttribute('class', "bit-box-spacing");
			if (barray[i] == 1) {
				div_spacing.innerHTML += '<div class="bit-box ' + color[i] + '">1</div>';
			} else {
				div_spacing.innerHTML += '<div class="bit-box ' + color[i] + '">0</div>';
			}
			div.appendChild(div_spacing);
		}
	} else {
		for (i = 0; i < barray.length; i++) {
			div_spacing = document.createElement('div');
			div_spacing.setAttribute('class', "bit-box-spacing");
			if (barray[i] == 1) {
				div_spacing.innerHTML += '<div class="bit-box ' + color + '">1</div>';
			} else {
				div_spacing.innerHTML += '<div class="bit-box ' + color + '">0</div>';
			}
			div.appendChild(div_spacing);
		}
	}
	div.appendChild(div_row);
	out_div.appendChild(div);
}

function append_operand_to_div(out_div, operand)
{
	var operand_div = document.createElement('p');
	operand_div.innerHTML = operand.toString(10) + " 0x" + int_to_hex(operand);
	out_div.appendChild(operand_div);
}

function write_to_div(name, text)
{
	var div = document.getElementById(name);
	div.innerHTML = text;
}

function add_to_div(name, text)
{
	var div = document.getElementById(name);
	div.innerHTML += text;
}

function is_object(o) 
{
	return o != null && typeof o === 'object';
}

// binary operators
var TOK_ADD = "+";
var TOK_SUB = "-";
var TOK_MUL = "*";
var TOK_DIV = "/";
var TOK_MOD = "%";
var TOK_BLSHF = "<<";
var TOK_BRSHF = ">>";
var TOK_BOR = "|";
var TOK_BAND = "&";
var TOK_BXOR = "^";  
// unary operators
var TOK_BNOT = "~";
var TOK_LNOT = "!";
var TOK_UMINUS = "-";
var TOK_UPLUS = "+";
var g_switchcontent_uid = 0;

function display_op_container(op_div, text, id)
{
	var calc_out_div = document.getElementById("calculator-output");
	var op_div_ext = document.createElement("div");
	op_div_ext.setAttribute('class', 'operation');
	op_div.setAttribute('class', 'operation-in');
	op_div.setAttribute('id', 'op-id-' + id);
	var op_desc_span = document.createElement("span");
	op_desc_span.innerHTML = text;
	op_desc_span.setAttribute('class', 'op-title');
	var op_desc_ceop = document.createElement("span");
	op_desc_ceop.setAttribute('class', 'ceop-text');
	op_desc_ceop.setAttribute('id', 'op-id-' + id + '-title');
	
	op_div_ext.appendChild(op_desc_span);
	op_div_ext.appendChild(op_desc_ceop);
	calc_out_div.appendChild(op_div_ext);
	calc_out_div.appendChild(op_div);
}

function parse_ast(parse_tree, root, branch)
{
	// TODO: add automatic cleaning of results when RE-clicked
	var num;
	var token_info;
	
	// resolve left branch
	if (is_object(parse_tree.left)) {
		parse_ast(parse_tree.left, parse_tree, "left");
	}
	// resolve right branch
	if (is_object(parse_tree.right)) {
		parse_ast(parse_tree.right, parse_tree, "right");
	}
	
	switch (parse_tree.type) {
	case "binary_expr":
		var bset_left;
		var bset_right;
		var colorset;
		var op_div;
		
		token_info = { token: parse_tree.operator, left: parse_tree.left, right: parse_tree.right };
		
		bset_left = int_to_bin(token_info.left, 32);
		bset_right = int_to_bin(token_info.right, 32);
		
		switch (parse_tree.operator) {
		case TOK_ADD:
			num = parse_tree.left + parse_tree.right;
		break;
		case TOK_SUB:
			num = parse_tree.left - parse_tree.right;
		break;
		case TOK_MUL:
			num = parse_tree.left * parse_tree.right;
		break;
		case TOK_DIV:
			num = parse_tree.left / parse_tree.right;
		break;
		case TOK_MOD:
			num = parse_tree.left % parse_tree.right;
		break;
		case TOK_BLSHF:
			num = parse_tree.left << parse_tree.right;
		break;
		case TOK_BRSHF:
			num = parse_tree.left >> parse_tree.right;
		break;
		case TOK_BOR:
			num = parse_tree.left | parse_tree.right;
		break;
		case TOK_BAND:
			num = parse_tree.left & parse_tree.right;
		break;
		case TOK_BXOR:
			num = parse_tree.left ^ parse_tree.right;
		break;
		default:
			alert("unknown binary operator!");
		break;
		}
		
		op_div = document.createElement('div');

		// left operand
		append_operand_to_div(op_div, token_info.left);
		generate_div_bitset(op_div, bset_left, "box-red");
		
		// right operand
		append_operand_to_div(op_div, token_info.right);
		generate_div_bitset(op_div, bset_right, "box-blue");
			
		// result
		bset = Bitset(num, 32, token_info);
		barray = bset.barray;
		colorset = bitset_tri_compare(barray, bset_left, bset_right);
		append_operand_to_div(op_div, num);
		generate_div_bitset(op_div, barray, colorset);
		
		display_op_container(op_div, "0x" + int_to_hex(token_info.left) + " " + token_info.token + " " + "0x" + int_to_hex(token_info.right) + " = " + "0x" + int_to_hex(num), g_switchcontent_uid);
		
		g_switchcontent_uid++;
	break;
	case "unary_expr":
		var bset;
		var bset_expr;
		var op_div;
		
		// resolve expression
		if (is_object(parse_tree.expr)) {
			parse_ast(parse_tree.expr, parse_tree, "expr");
		}
		
		token_info = { token:parse_tree.operator, expr: parse_tree.expr };
		bset_expr = int_to_bin(token_info.expr, 32);
		
		switch (parse_tree.operator) {
		case TOK_BNOT:
			num = ~parse_tree.expr;
		break;
		case TOK_LNOT:
			num = (!parse_tree.expr) === true ? 1 : 0;
		break;
		case TOK_UMINUS:
			num = -parse_tree.expr;
		break;
		case TOK_UPLUS:
			// silently ignore
		break;
		default:
			alert("unknown unary operator!");
		break;
		}
		
		op_div = document.createElement('div');

		// expr
		append_operand_to_div(op_div, token_info.expr);
		generate_div_bitset(op_div, bset_expr, "box-red");
			
		// result
		bset = Bitset(num, 32, token_info);
		barray = bset.barray;
		colorset = bitset_two_compare(barray, bset_expr);
		append_operand_to_div(op_div, num);
		generate_div_bitset(op_div, barray, colorset);
		
		display_op_container(op_div, token_info.token + "0x" + int_to_hex(token_info.expr) + " = " + "0x" + int_to_hex(num), g_switchcontent_uid);
		
		g_switchcontent_uid++;
	break;
	default:
		alert("unknown expression!");
	break;
	}
	
	// resolve
	if (is_object(root)) {
		root[branch] = num;
	}
}

window.onload = init_calc;

function init_calc() 
{
		var addEvent = function(elem, type, fn) { // Simple utility for cross-browser event handling
			if (elem.addEventListener != null) 
				elem.addEventListener(type, fn, false);
			else if (elem.attachEvent != null) 
				elem.attachEvent('on' + type, fn);
		},
		textField = document.getElementById('calc'),
		placeholder = 'e.g. (2 & 1) * 2 | 1 - ~0'; // The placeholder text
		textField.value = placeholder;
		addEvent(textField, 'focus', function() {
			if (this.value === placeholder) this.value = '';
		});
		addEvent(textField, 'blur', function() {
			if (this.value === '') this.value = placeholder;
		});
};
function bitviz_parse_input()
{
	var input;
	var parse_tree;
	var op_div;
	
	input = document.getElementById('calc').value;
	
	try {
		parse_tree = parser.parse(input);
	} catch(e) {
		alert(e.message);
	}
	// parse abstract syntax tree
	parse_ast(parse_tree, null, null);
	// setup collapsable result divs
	op_div = new switchicon("operation-in", "div");
	op_div.setHeader('[Hide]', '[Show]');
	op_div.collapsePrevious(false);
	op_div.init();
}
