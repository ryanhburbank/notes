function bitwiseAddition(x, y) {
    if (y === 0) {
        console.log('summed value x: ', x + '(' + Number(x).toString(2) + ')');
        return x;
    }
    console.log('x: ', x, '(' + Number(x).toString(2) + ')', ' y: ', y, '(' + Number(y).toString(2) + ')');
    // carry contains common set of bits of x & y;
    var carry = x & y;
    console.log('carry: ', carry + '(' + Number(carry).toString(2) + ')');

    // sum of bits of y & y where one but not both bits are not set
    x = x ^ y;
    console.log('x after XOR: ', x + '(' + Number(x).toString(2) + ')');

    // carry is shifted by one so that adding it to x gives the required sum;
    y = carry << 1;
    console.log('y after carry left shift 1: ', y + '(' + Number(y).toString(2) + ')');
    return bitwiseAddition(x, y);
}

// console.log(bitwiseAddition(1, 1));
console.log(bitwiseAddition(5, 7));