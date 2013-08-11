/*
 * PEG Grammar rules for BitViz
 */
{
  function createUnaryExpr(op, e) {
    return {
      type     : 'unary_expr',
      operator : op,
      expr     : e
    }
  }

  function createBinaryExpr(op, left, right) {
    return {
      type      : 'binary_expr',
      operator  : op,
      left      : left,
      right     : right
    }  
  }

  function createList(head, tail) {
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i][3]);
    }
    return result;
  }

  function createExprList(head, tail, room) {
    var epList = createList(head, tail);
    var exprList  = [];
    var ep;
    for (var i = 0; i < epList.length; i++) {
      ep = epList[i]; 
      //the ep has already added to the global params
      if (ep.type == 'param') {
        ep.room = room;
        ep.pos  = i;
      } else {
        exprList.push(ep);  
      }
    }
    return exprList;
  }

  function createBinaryExprChain(head, tail) {
    var result = head;
    for (var i = 0; i < tail.length; i++) {
      result = createBinaryExpr(tail[i][1], result, tail[i][3]);
    }
    return result;
  }
}
// Always start at operator with *lowest* precedence
start 
  = bit_or
  
// predefined characters
LPAREN = '('
RPAREN = ')'
__ "whitespace"
    = [ \t\r\n]*

/* Lowest -> highest operator precedence */

expr 
  = bit_or

bit_or 
  = head:bit_xor
    tail:(__ "|" __ bit_xor)* {
      return createBinaryExprChain(head, tail);
	}

bit_xor
  = head:bit_and
    tail:(__ "^" __ bit_and)* {
	  return createBinaryExprChain(head, tail);
	}

bit_and
  = head:bit_rshf
    tail:(__ "&" __ bit_rshf)* {
	  return createBinaryExprChain(head, tail);
	}

bit_rshf
  = head:bit_lshf
    tail:(__ ">>" __ bit_lshf)* {
	  return createBinaryExprChain(head, tail);
	}

bit_lshf
  = head:additive_expr
    tail:(__ "<<" __ additive_expr)* {
	  return createBinaryExprChain(head, tail);
	}

additive_expr
  = head:multiplicative_expr
    tail:(__ additive_operator __ multiplicative_expr)* {
	  return createBinaryExprChain(head, tail);
	}
	
additive_operator
  = "+" / "-"

multiplicative_expr
  = head:unary_expr
    tail:(__ multiplicative_operator __ unary_expr)* {
	  return createBinaryExprChain(head, tail);
	}
	
multiplicative_operator
  = "*" / "/" / "%"

unary_expr
  = primary / operator:unary_operator __ expr:unary_expr {
      return createUnaryExpr(operator, expr);
	}
  
unary_operator
  = "!" / "~" / "-" / "+"

primary
  = digits
  / LPAREN __ e:expr __ RPAREN {
      e.paren = true;
	  return e;
    }

digits = hex / integer

integer "integer"
  = digits:[0-9]+ { return parseInt(digits.join(""), 10); }

hex "hexadecimal"
  = "0" [xX] hexs:[0-9A-Fa-f]+ { return parseInt(hexs.join(""), 16); }