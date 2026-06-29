---
title: "Data Lab"
categories: [学习]
summary: "csapp-data lab"
cover_position: "50% 50%"
slug: data-lab
---

# 1. bitXor
```
/*
 * bitXor - x^y using only ~ and &
 *   Example: bitXor(4, 5) = 1 0100 0101
 *   Legal ops: ~ &
 *   Max ops: 14
 *   Rating: 1
 */
```

要求实现异或，真值表：

| x   | y   | x XOR y |
| --- | --- | ------- |
| 0   | 0   | 0       |
| 0   | 1   | 1       |
| 1   | 0   | 1       |
| 1   | 1   | 0       |


德摩根律：$\neg(A \land B)=\neg A \lor \neg B$ 、$\neg(A \lor B)=\neg A \land \neg B$

$$
\begin{aligned}
x \oplus y
&= (x \land \neg y) \lor (\neg x \land y) \\[4pt]
&= \neg\Bigl(\neg(x \land \neg y) \land \neg(\neg x \land y)\Bigr)
\end{aligned}
$$

```
int bitXor(int x, int y) {
  return ~(~(x & ~y) & ~(~x & y)); // ~(~x & ~y) & ~(x & y)
}
```
---
# 2. tmin
```
/*
 * tmin - return minimum two's complement integer
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 4
 *   Rating: 1
 */
```
要求返回最小值，即 0x80000000。

```
int tmin(void) {
    return 1 << 31;
}
```
---
# 3. isTmax
```
/*
 * isTmax - returns 1 if x is the maximum, two's complement number,
 *     and 0 otherwise
 *   Legal ops: ! ~ & ^ | +
 *   Max ops: 10
 *   Rating: 2
 */
```
注意到
```
Tmax = 0111...1111
Tmax + 1 = 1000...0000 = Tmin

Tmax + (Tmax + 1)
=
0111...1111
+
1000...0000
=
1111...1111
=
-1
```
我们可以通过 `x + (x + 1) == -1` 来判断`Tmax`，但`x = - 1`对这个等式也成立：
```
x = -1 = 1111...1111
x + 1 = 0000...0000
x + (x + 1) = 1111...1111
```
所以我们还需要排除`x = -1`：
```
int isTmax(int x) { // 0111 1111 1111 1111 1111 1111 1111 1111
    int y = x + 1;
    return !!y & !(~(x + y));
}
```
---
# 4. allOddBits
```
/*
 * allOddBits - return 1 if all odd-numbered bits in word set to 1
 *   Examples allOddBits(0xFFFFFFFD) = 0, allOddBits(0xAAAAAAAA) = 1
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 12
 *   Rating: 2
 */
```
要求判断`x`的奇数位是否全为1，是则返回`1`。

思路很简单，提取`x`的奇数位然后比较即可。我们通过对应的掩码与操作提取：`x & 0xAAAAAAAA // 1010...1010` ，通过异或判断是否相等。注意位编码以`0`开始。

但由于 Data Lab 不允许使用大常数，我们需要构建出对应的掩码。
```
1. Integer constants 0 through 255 (0xFF), inclusive. You are
      not allowed to use big constants such as 0xffffffff.
```

```
int allOddBits(int x) {  
     int mask = 0xAA; // 1010 1010
     mask = mask | (mask << 8); // 1010 1010 0000 0000 | 0000 0000 1010 1010
     mask = mask | (mask << 16); // mask = 0xAAAAAAAA;
     return !((x & mask) ^ mask);
}
```
---
# 5. negate
```
/*
 * negate - return -x
 *   Example: negate(1) = -1.
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 5
 *   Rating: 2
 */
```
负数 = 取反加一，即：
$$  
-x = \mathord{\sim}x + 1 
$$

证明如下：

> [!note] 补码原理证明
> $$ x + (\mathord{\sim}x + 1) \equiv 0 \pmod{2^n} $$
>
> 设 $x$ 是一个 $n$ 位二进制位模式。$n$ 位计算机只能保存低 $n$ 位，所以整数运算本质上是在模 $2^n$ 的意义下进行的。也就是说，我们只需要证明上述同余式成立。
>
> 如果这个式子成立，那么 $\mathord{\sim}x + 1$ 就是 $x$ 在模 $2^n$ 意义下的加法逆元，因此它就是补码系统中的 $-x$。
>
> 因为 $\mathord{\sim}x$ 表示对 $x$ 按位取反，所以 $x$ 和 $\mathord{\sim}x$ 的每一位都互补。例如：$x = 00000101$，则：$\mathord{\sim}x = 11111010$。所以每一位相加后都会得到 $1$，因此：
> $$
> x + \mathord{\sim}x = \underbrace{111\dots111}_{n\text{位}}
> $$
>
> 这里的 $\underbrace{111\dots111}_{n\text{位}}$ 一共有 $n$ 位。它的无符号数值为：
> $$
> \underbrace{111\dots111}_{n\text{位}} = 2^{n-1} + 2^{n-2} + \dots + 2^1 + 2^0
> $$
>
> 根据等比数列求和公式：
> $$
> 2^{n-1} + 2^{n-2} + \dots + 2^1 + 2^0 = 2^n - 1
> $$
>
> 所以：
> $$
> x + \mathord{\sim}x = 2^n - 1
> $$
>
> 两边同时加 $1$，得到：
> $$
> x + \mathord{\sim}x + 1 = 2^n
> $$
>
> 也就是：
> $$
> x + (\mathord{\sim}x + 1) = 2^n
> $$
>
> 由于 $n$ 位机器只保留低 $n$ 位，所以：
> $$
> 2^n \equiv 0 \pmod{2^n}
> $$
>
> 因此：
> $$
> x + (\mathord{\sim}x + 1) \equiv 0 \pmod{2^n}
> $$
>
> 这说明 $\mathord{\sim}x + 1$ 是 $x$ 的加法逆元。
>
> 所以：
> $$
> -x = \mathord{\sim}x + 1
> $$
>
> **证毕。**

---
# 6. isAsciiDigit
```
/*
 * isAsciiDigit - return 1 if 0x30 <= x <= 0x39 (ASCII codes for characters '0' to '9')
 *   Example: isAsciiDigit(0x35) = 1.
 *            isAsciiDigit(0x3a) = 0.
 *            isAsciiDigit(0x05) = 0.
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 15
 *   Rating: 3
 */
```
判断 `0x30 <= x <= 0x39`，分别得到两段的符号位用`|`返回即可。
```
int isAsciiDigit(int x) {
    int lower = (x + (~0x30 + 1)) >> 31;
    int upper = (0x39 + (~x + 1)) >> 31; // 取 x - 0x30 和 0x39 - x 的符号位
    return !(lower | upper); // 如果两段的符号位都是 0 ，代表x在范围内
}
```
---
# 7. conditional
```
/*
 * conditional - same as x ? y : z
 *   Example: conditional(2,4,5) = 4    0010 : 1000 ? 1001
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 16
 *   Rating: 3
 */
```

要求实现三目运算符。难点在于怎么返回一个具体的数？

可以通过把条件`x`转成一个掩码来实现：如果 x = 0 ，那么 !x = 1。如果 x != 0，那么 !x = 0。构造`mask = ~(!x) + 1`。`x = 0`时`mask = ~1 + 1 = 全1`；`x = 1`时`mask = ~0 + 1 = 全0`；通过位运算来模拟条件选择。
```
int conditional(int x, int y, int z) {
    int mask = ~(!x) + 1;
    return (~mask & y) | (mask & z);
}
```

---
# 8. isLessOrEqual
```
/*
 * isLessOrEqual - if x <= y  then return 1, else return 0
 *   Example: isLessOrEqual(4,5) = 1.
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 24
 *   Rating: 3
 */
```

判断 $x \le y$，等价于 $y - x \ge 0$，即判断 $y - x$ 的符号位是否为 0。但这里可能存在溢出问题：

在 32 位补码中，`int` 的范围是 $-2^{31} \sim 2^{31} - 1$。考虑这个例子：
```
x = 0x80000000   // Tmin = -2147483648
y = 0x7fffffff   // Tmax =  2147483647
```
数学上 $x \le y$，因为 $-2147483648 \le 2147483647$。但实际 $2147483647 + 2147483648 = 4294967295$ 超出了 32 位补码 `int` 的表示范围，按 32 位截断后：$4294967295 = 0xffffffff$，作为有符号补码对应 $-1$。

分情况讨论符号：只有 $y$ 和 $x$ 异号时，他们相减才有可能溢出。

```
int isLessOrEqual(int x, int y) {
    int sx = (x >> 31) & 1;
    int sy = (y >> 31) & 1;
    
    int signDiff = sx ^ sy;

    return (signDiff & sx) | (!signDiff & !((y + (~x + 1)) >> 31)); // (异号 && x < 0) || (同号 && y - x >= 0);

}
```
---
# 9. logicalNeg
```
/*
 * logicalNeg - implement the ! operator, using all of
 *              the legal operators except !
 *   Examples: logicalNeg(3) = 0, logicalNeg(0) = 1
 *   Legal ops: ~ & ^ | + << >>
 *   Max ops: 12
 *   Rating: 4
 */
```

注意到：对于任意非零 `x`，`x` 和 `-x` 里面至少有一个符号位是 `1`。只有 `x == 0` 时，`x` 和 `-x` 的符号位都是 `0`。
```
int logicalNeg(int x) {
    return ((x | (~x + 1)) >> 31) + 1;
}
```

---
# 10. howManyBits
```
/* howManyBits - return the minimum number of bits required to represent x in
 *             two's complement
 *  Examples: howManyBits(12) = 5
 *            howManyBits(298) = 10
 *            howManyBits(-5) = 4
 *            howManyBits(0)  = 1
 *            howManyBits(-1) = 1
 *            howManyBits(0x80000000) = 32
 *  Legal ops: ! ~ & ^ | + << >>
 *  Max ops: 90
 *  Rating: 4
 */
```

本质在问：为了保留 `x` 的数值，最少需要多少位补码？
- 正数：找最高的 `1` 在哪，再加一个符号位。
- 负数：前面的`1`是符号拓展位，先取反 `~x`，再找最高的 `1`。

```
	int sign = x >> 31;
	x = (sign & ~x) | (~sign & x);
```

现在问题统一变成找`x`的最高位`1`。用二分法找到最高 1 的位置；最后加一个符号位。

```
int howManyBits(int x) {
    int sign = x >> 31;

    /*
     * 如果 x >= 0，sign = 0x00000000，保留 x
     * 如果 x < 0， sign = 0xffffffff，变成 ~x
     */
    x = (sign & ~x) | (~sign & x);

    // 二分找最高的 1
    int b16 = !!(x >> 16) << 4;
    x = x >> b16;

    int b8 = !!(x >> 8) << 3;
    x = x >> b8;

    int b4 = !!(x >> 4) << 2;
    x = x >> b4;

    int b2 = !!(x >> 2) << 1;
    x = x >> b2;

    int b1 = !!(x >> 1);
    x = x >> b1;

    int b0 = x;

    return b16 + b8 + b4 + b2 + b1 + b0 + 1;
}
```
---
# 11. float_twice
```
/*
 * float_twice - Return bit-level equivalent of expression 2*f for
 *   floating point argument f.
 *   Both the argument and result are passed as unsigned int's, but
 *   they are to be interpreted as the bit-level representation of
 *   single-precision floating point values.
 *   When argument is NaN, return argument
 *   Legal ops: Any integer/unsigned operations incl. ||, &&. also if, while
 *   Max ops: 30
 *   Rating: 4
 */
```

![[博客/学习/csapp/data/Pasted image 20260629215519.png]]
浮点数乘以 2，本质上就是指数 exp + 1。但是要特殊处理 0、非规格化数、无穷大、NaN。

- 规格化数形式是：$(-1)^s \times 1.frac \times 2^{E}$，乘以 2：$(-1)^s \times 1.frac \times 2^{E+1}$
- 非规格化数没有隐藏的 `1`，它的形式是：$(-1)^s \times 0.frac \times 2^{-126}$。所以乘以 2 时，直接让 `frac` 左移一位即可。

```
unsigned float_twice(unsigned uf) {
    unsigned sign = uf & 0x80000000;
    unsigned exp  = uf & 0x7f800000;
    unsigned frac = uf & 0x007fffff;

    /*
     * exp 全 1：NaN 或 infinity
     * NaN 要返回原值，infinity * 2 还是 infinity
     */
    if (exp == 0x7f800000) {
        return uf;
    }

    /*
     * exp 全 0：0 或非规格化数
     * 乘以 2 相当于 frac 左移一位
     */
    if (exp == 0) {
        frac = frac << 1;
        return sign | frac;
    }

    /*
     * 规格化数：
     * 乘以 2 相当于 exponent + 1
     */
    exp = exp + 0x00800000; // exp += 1 << 23;

    return sign | exp | frac;
}
```

---
# 12. float_i2f

```
/*
 * float_i2f - Return bit-level equivalent of expression (float) x
 *   Result is returned as unsigned int, but
 *   it is to be interpreted as the bit-level representation of a
 *   single-precision floating point values.
 *   Legal ops: Any integer/unsigned operations incl. ||, &&. also if, while
 *   Max ops: 30
 *   Rating: 4
 */
```


```
unsigned float_i2f(int x) {
    unsigned sign;
    unsigned ux;
    unsigned tmp;
    int p;
    unsigned exp;
    unsigned frac;

    if (x == 0) {
        return 0;
    }

    // 符号位
    sign = ((unsigned)x >> 31) << 31;

    // 取绝对值，注意不能直接 -x，因为 x = INT_MIN 时会溢出
    if (x < 0) {
        ux = ~((unsigned)x) + 1;
    } else {
        ux = (unsigned)x;
    }

    // 找最高位的 1 在哪里
    // 例如 ux = 13 = 1101b，最高位位置 p = 3
    p = 0;
    tmp = ux;
    while (tmp >>= 1) {
        p++;
    }

    // 指数域 = E + bias
    // 对整数来说，E 就是最高位 1 的位置 p
    exp = (p + 127) << 23;

    // 如果最高位位置 p <= 23，说明可以精确表示，不需要舍入
    if (p <= 23) {
        frac = (ux & ((1u << p) - 1)) << (23 - p);
    } else {
        // 如果 p > 23，说明有效位超过 float 的 24 位精度，需要舍入
        int shift = p - 23;

        // 取前 24 位：包含最高位隐藏的 1
        unsigned top = ux >> shift;

        // 被丢掉的低位
        unsigned lost = ux & ((1u << shift) - 1);

        // 正好一半的位置
        unsigned half = 1u << (shift - 1);

        // frac 只保留后 23 位，最高位的 1 不存
        frac = top & 0x7fffff;

        // round to nearest even
        if (lost > half || (lost == half && (top & 1))) {
            top++;

            // 如果进位导致 top 变成 1000000000000000000000000b
            // 说明 1.111... 舍入成了 10.000...
            if (top == (1u << 24)) {
                exp += 1 << 23;
                frac = 0;
            } else {
                frac = top & 0x7fffff;
            }
        }
    }

    return sign | exp | frac;
}
```

---
# 13. float_f2i
```
/*
 * float_f2i - Return bit-level equivalent of expression (int) f
 *   for floating point argument f.
 *   Argument is passed as unsigned int, but
 *   it is to be interpreted as the bit-level representation of a
 *   single-precision floating point value.
 *   Anything out of range (including NaN and infinity) should return
 *   0x80000000u.
 *   Legal ops: Any integer/unsigned operations incl. ||, &&. also if, while
 *   Max ops: 30
 *   Rating: 4
 */
```

对于规格化浮点数：$f = (-1)^s \times (1.frac)_2 \times 2^E$，其中：E = exp - 127$$$(1.frac)_2 = \frac{2^{23} + frac}{2^{23}}$$所以：
$$|f| = (2^{23} + frac) \times 2^{E - 23}$$

```
int float_f2i(unsigned uf) {
    unsigned sign = uf >> 31;
    int exp = (uf >> 23) & 0xff;
    unsigned frac = uf & 0x7fffff;


    int E = exp - 127;


    // exp 全 1：NaN 或 infinity
    if (exp == 0xff) {
        return 0x80000000u;
    }

  
    // exp == 0：0 或非规格数，绝对值都小于 1，转 int 为 0
    if (exp == 0) {
        return 0;
    }


    // 如果 E < 0，说明 |f| < 1，转 int 为 0
    if (E < 0) {
        return 0;
    }

  
    // 如果 E >= 31，超出 int 范围
    if (E >= 31) {
        return 0x80000000u;
    }

  
    // 规格化数的有效数字：
    // M = 1.frac * 2^23
    unsigned M = (1 << 23) | frac;
    unsigned val;

  
    if (E >= 23) {
        val = M << (E - 23);
    } else {
        val = M >> (23 - E);
    }

  
    if (sign) {
        return -val;
    } else {
        return val;
    }
}
```