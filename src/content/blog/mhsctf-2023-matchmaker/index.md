---
title: '“Matchmaker”: Edmonds’ Algorithm for Maximum Weighted Matching'
description: 'During MHSCTF 2023, I utilized Edmonds’ beautifully crafted “Blossom algorithm” to solve a maximum weighted matching problem.'
date: 2023-02-14
tags: ['ctf', 'ppc']
banner:
  light: './assets/banner-light.svg'
  dark: './assets/banner-dark.svg'
authors: ['enscribe']
---

## Introduction

I was recently invited by the academic team "DN" (the name, surprisingly, has no inappropriate connotation) to compete in Mentor High School's second CTF iteration, [MHSCTF 2023](https://ctftime.org/event/1861). Although the competition ran for 15 days, we maxed out their 11 challenges in **just under 16 hours** (ignoring solve resets) and managed to take first place. This writeup was part of the verification process, which came with prize-receiving — enjoy!

## Matchmaker

<challenge-info>
<dl>
<div><dt>Solvers</dt><dd><a href="https://github.com/flocto"><img src="https://github.com/flocto.png" alt="" width="16" height="16" />flocto</a>, <a href="https://github.com/jktrn"><img src="https://github.com/jktrn.png" alt="" width="16" height="16" />enscribe</a></dd></div>
<div><dt>Author</dt><dd>0xmmalik</dd></div>
<div><dt>Category</dt><dd>

`PPC`

</dd></div>
<div><dt>Points</dt><dd>9</dd></div>
<div><dt>Remote</dt><dd><code>nc 0.cloud.chals.io [PORT]</code></dd></div>
<div><dt>Flag</dt><dd>

<challenge-flag>`valentine{l0V3_i5_1n_7he_4ir}`</challenge-flag>

</dd></div>
</dl>

I've just had the most brilliant idea 😮 I want to write a program that takes all the students and how much they like each other to pair them up so I can maximize the total love in the classroom! Of course, when I say "I," I really mean... "you" 😉

</challenge-info>

::::warning
Discrete math, graph theory, and combinatorial optimization ahead! If you're unfamiliar with the mathematical symbols used in this writeup, reference this dropdown:

:::notation[Complicated math symbols]{closed}
-   $\sum$ - Summation
-   $\in$ - Element of
-   $\notin$ - Not an element of
-   $\subset$ - Proper subset of
-   $\subseteq$ - Subset of
-   $\supseteq$ - Superset of
-   $\emptyset$ - Empty set
-   $\forall$ - For all
-   $\exists$ - There exists
-   $\nexists$ - There does not exist
-   $\ni$ - Contains as member
-   $\not\ni$ - Does not contain as member
-   $\setminus$ - Set minus (drop)
-   $\oplus$ - Direct sum
-   $\cup$ - Union
-   $\cap$ - Intersection
-   $x'$ - Prime
:::
::::

**First blood!** Here are the notes the author provided alongside the challenge description, abridged for brevity:

:::note
- The connection times out after 60 seconds, and there will be 3 iterations.
- The input will be given in $N$ lines, where $N$ represents the number of students. The first line represents the zeroth student, the second line represents the first student, and so on ($50 < N < 100$, $N \bmod 2 = 0$).
- Each line of input contains $N - 1$ integers $R$ (ranged $0 \leq R \leq 100$); $R$ represents a student's rating of another student at that index, repeated for everybody but themselves.
:::

I've cut the notes provided in half to make it a bit more digestible. Before we continue, let's see some sample input from the server for context:

~~~py title="`matchmaker.py{:file}`"
from pwn import *

p = remote('0.cloud.chals.io', [PORT])
print(p.recvuntilS(b'> '))
~~~

```ansi
[0;33m$[0m python3 matchmaker.py
[[0;32m+[0m] Opening connection to 0.cloud.chals.io on port [PORT]: Done
86 60 67 84 44 4 36 59 100 63 51 6 92 66 36 99 3 69 55 11 21 66 66 81 21 63 76 44 4 87 13 67 0 97 28 13 68 96 47 49 0 18 63 26 73 68 13 63 47 61 0 53 74 56 6 12 5 66 54 47 79 81 84 43 19 6 62 52 6 100 86 64 1 4 38 89 93 6 72 93 63 46 90 29 81 89 5 9 77 23 87 94 73
76 0 74 52 56 60 57 78 48 93 85 66 29 70 96 40 76 62 46 66 69 31 99 47 12 42 43 12 47 19 26 8 26 45 29 27 17 14 15 54 57 78 69 73 55 16 88 50 96 97 34 49 78 3 91 53 28 66 28 28 9 38 87 20 66 28 37 38 94 61 96 99 45 39 52 5 27 5 96 41 31 83 86 32 92 35 96 10 2 97 3 19 88
```

We can do a bit of analysis on what we've received so far. The first line, `86 60 67...`, can be translated into:

- Student 0 -> Student 1 = 86
- Student 0 -> Student 2 = 60
- Student 0 -> Student 3 = 67

Let's do the same thing for the second line, `76 0 74...`:

- Student 1 -> Student 0 = 76
- Student 1 -> Student 2 = 0
- Student 1 -> Student 3 = 74

Notice how the student will always skip their own index, which aligns with the author's notes detailing how the integers "represent the students' ratings of everybody but themselves." Let's continue with the rest of the notes:

:::note
- Determine the pairings that maximize the students' ratings for each other
- **Example**: If Student 1 -> Student 7 = 98 and Student 7 -> Student 1 = 87, and Students 1 and 7 are paired, the *score* of this pairing would be $98 + 87 = 185$
- The output should list all maximized pairs (including duplicates; order of the pairs does not matter)
- **Example**: If Student 0 -> Student 3, Student 1 -> Student 2, and Student 4 -> Student 5, the desired output is: `0,3;1,2;2,1;3,0;4,5;5,4`
- The connection will close if the output is incorrect, and reiterate if correct
:::

Let's crack on with the actual algorithm which will be used for solving this!

### Graph theory fundamentals

This challenge is a classic example of a concept called "maximum weight matching," which is fundamental in **graph theory** and **discrete mathematics**. Although there is a relatively high prerequisite knowledge floor for understanding these concepts, I'll explain them as best as I can.

Firstly, let's define a **graph**:

:::definition[Graph]
A graph is a set of **vertices** (or nodes), which are connected by **edges**. Not to be confused with the [Cartesian coordinate system](https://en.wikipedia.org/wiki/Cartesian_coordinate_system), graphs are represented by the [ordered pair](https://en.wikipedia.org/wiki/Ordered_pair) $G = (V,\ E)$ in which $V$ is a [set](<https://en.wikipedia.org/wiki/Set_(mathematics)>) of vertices and $E$ is a set of edges.
:::

This is a simple graph:

![Graph](./assets/graph.svg)

:::definition[Edges and endpoints]
A set of edges $E$ is defined as:
$$
E \subset \{(x, y)\ |\ (x, y) \in V^2 \textrm{ and } x \neq y\}
$$
By this definition, $x$ and $y$ are the vertices that are connected to the edge $e$, called the **endpoints**. It can also be said that $e$ is **incident** to $x$ and $y$.
:::

We can create a **matching** $M \subseteq E$ within the graph $G$, in which $M$ is a collection of edges such that every vertex $v$ of $V$ is incident to at <u>most</u> one edge of $M$ (meaning two edges cannot share the same vertex). When the highest possible **cardinality** (number of matched edges) is reached, the matching is considered **maximum**, and any vertex $v$ not incident to any edge in $M$ is considered **exposed**.

:::definition[Maximum matching]
Formally, a matching $M$ is said to be **maximum** if for any other matching $M'$, $|M| \geq |M'|$. In other words, $M$ is the largest matching possible.
:::

For example, the following is a maximum matching performed on the graph above:

![Matching](./assets/matching.svg)

:::definition[Perfect matching]
Since there is an exposed vertex in this graph (and because the size of $V$ is odd), the matching is not considered **perfect**. A **perfect matching** occurs when the size of $V$ is even and there are no exposed vertices (meaning $|M| = |V|/2$); every perfect matching is automatically maximum.
:::

Now, let's put **weights** into consideration (i.e. the students' ratings). With a **weighted graph** $G = (V,\ E,\ w)$, we can attribute a function $w$ that assigns a weight $w(e)$ to each edge $e \in E$ (defining $w : E \rightarrow \mathbb{N}$):

![Weights](./assets/weights.svg)

The total weight of a matching $M$, written as $w(M)$, can be defined as:

$$
w(M) = \sum_{e \in M}w(e)
$$

Solving for $w(M)$ in the example graph above:

$$
w(M) = w((1, 2)) + w((3, 4)) + w((5, 6)) + w((8, 9)) \\\\
w(M) = 5 + 2 + 9 + 6 = 22
$$

Our goal is to maximize $w(M)$ — it is _definitely_ not maximized above, since $w(M)$ is not at its highest possible value. We will be tackling it with a combination of two different concepts: [Edmonds' blossom algorithm](https://en.wikipedia.org/wiki/Blossom_algorithm), and the [primal-dual method](<https://en.wikipedia.org/wiki/Duality_(optimization)>). Although the blossom algorithm is typically meant for [maximum cardinality matching](https://en.wikipedia.org/wiki/Maximum_cardinality_matching) (maximizing the size of $M$ itself, and running in $\mathcal{O}(|E||V|^2)$ time), utilizing it as a subroutine alongside the primal-dual method of linear programming creates a [maximum weight matching](https://en.wikipedia.org/wiki/Maximum_weight_matching) (and running in $\mathcal{O}(|V|^3)$ time).

Firstly, let's get started with how it works.

### The blossom algorithm

The core idea behind the blossom algorithm itself involves two concepts: **augmenting paths** and **blossoms** (alongside **blossom contraction**).

#### Augmenting paths

Given a graph $G = (V,\ E)$, a path $P$ in $G$ can be considered an **alternating path** if edges in the path are alternately <u>in</u> $M$ and <u>not in</u> $M$. **Augmenting paths** are a type of alternating, odd-length path that starts and ends with two exposed vertices:

![Augmenting Paths](./assets/augmenting-paths.svg)

As we can see, $P$ is considered an augmenting path because it ends with two exposed vertices. Augmenting paths are special in that they can **augment** ("to improve", as per the name) the size of $M$ by one edge. To do so, simply swap the edges in $P$ that are <u>in</u> $M$ with the edges that are <u>not in</u> $M$:

![Augmented Path](./assets/augmented-path.svg)

:::definition[Matching augmentation]
A **matching augmentation** along an augmenting path $P$ is a process by which $M$ is replaced by $M'$, defined as such:

$$
M' = M \oplus P = (M \setminus P) \cup (P \setminus M)
$$

This implies that $|M \oplus P| = |M| + 1$.
:::

The reason why augmenting paths are so fundamental to the blossom algorithm is that augmenting along them is exactly what grows a matching into a maximum one — we can reiterate the process of finding augmenting paths until no more are available in $G$. This is described well with [Berge's theorem](https://en.wikipedia.org/wiki/Berge%27s_theorem):

:::theorem[Berge's theorem]
A matching $M$ in a graph $G$ is maximum <u>if and only if</u> there is no $M$-augmenting path in $G$.
:::

Here is high-level pseudocode which describes this recursive iteration:

```ansi
[0;33mprocedure[0m [0;91mfind_maximum_matching[0m([0;93mG[0m, [0;93mM[0m)
    [0;31mP[0m = [0;91mfind_augmenting_path[0m([0;93mG[0m, [0;93mM[0m)
    [0;33mif[0m  [0;31mP[0m == [] [0;33mthen[0m
        [0;33mreturn[0m M
    [0;33melse[0m
        [0;31mMP[0m = [0;91maugment_matching[0m([0;93mM[0m, [0;31mP[0m)
        [0;33mreturn[0m [0;91mfind_maximum_matching[0m([0;93mG[0m, [0;31mMP[0m)
    [0;33mend if[0m
[0;33mend procedure[0m
```

:::remark[Augmenting paths]
Under the context of the above pseudocode, `[0;91mfind_augmenting_path[0m([0;93mG[0m, [0;93mM[0m){:ansi}` will always start at an exposed vertex, running a [breadth-first search](https://en.wikipedia.org/wiki/Breadth-first_search) to find an augmenting path.
:::

Therefore, the blossom algorithm will always terminate with a maximum matching.

#### Blossoms (and blossom contraction)

The second concept that we need to understand is **blossoms**. Given a graph $G$ and a matching $M$, a blossom $B$ is a "cycle" within $G$ which consists of $2k + 1$ edges, of which exactly $k$ belong to $M$ (a blossom with two matches would have $2(2) + 1 = 5$ edges).

Let's say the algorithm created matchings in a graph with a blossom — although it isn't the maximum matching possible, the search gets stuck: an augmenting path technically exists (running along the bottom of the cycle), but a search that marks vertices as visited can enter the cycle from the wrong side, dead-end, and terminate suboptimally:

![Blossom](./assets/blossom.svg)

This is where **blossom contraction** comes in. The idea is to contract the blossom $B$ into a single "super-vertex" $v_B$, and to treat it as a single vertex in the graph:

![Blossom Contraction](./assets/blossom-contraction.svg)

From there, we can find valid augmenting paths to augment $M$:

![Augmented Blossom](./assets/augmented-blossom.svg)

Finally, we can expand the blossom $B$ back into its original form, to reveal the maximum matching:

![Expanded Blossom](./assets/expanded-blossom.svg)

:::theorem[Blossoms theorem]
If $G'$ is the graph formed after contraction of a blossom $B$ in $G$, then $G$ has an augmenting path <u>if and only if</u> $G'$ has an augmenting path.
:::

With the fundamental concepts of this beautiful algorithm covered, the only thing we need to wrap our heads around is how to adapt this to weighted graphs. I'll be referencing Galil's [Efficient Algorithms for Finding Maximum Matching in Graphs](https://web.archive.org/web/20201126210546/http://www.cs.kent.edu/~dragan/GraphAn/p23-galil.pdf) for this section.

### Primal-dual method

#### Matchings as linear programs

The blossom algorithm we described above only maximizes the size of $M$. To include weights, give every edge $e$ a variable $x_e$. We set $x_e = 1$ when $e$ belongs to the matching and $x_e = 0$ otherwise:

:::definition[Maximum weight matching as an integer program]
$$
\begin{aligned}
\textrm{maximize} \quad & \sum_{e \in E} w(e)x_e \\
\textrm{subject to} \quad & \sum_{e\ \textrm{incident to}\ i} x_e \leq 1 && \forall i \in V \\
& x_e \in \{0,1\} && \forall e \in E
\end{aligned}
$$
:::

The sum at the top is the total weight of the selected edges. The first constraint prevents two selected edges from sharing a vertex, and the second makes each edge either selected or unselected.

That last constraint also makes this an **integer program**, not a linear program. We can relax it by allowing any $x_e \geq 0$. The degree constraint already prevents $x_e$ from exceeding $1$. This gives us a linear program which may allow fractional values, but it also gives us something useful called a **dual**.

#### The dual program

The dual has one variable $u_i \geq 0$ for each vertex. A valid set of dual variables must satisfy $u_i + u_j \geq w(i,\ j)$ for every edge $(i,\ j)$:

:::definition[Dual of the relaxed program]
$$
\textrm{minimize} \quad \sum_{i \in V} u_i \quad \textrm{subject to} \quad u_i + u_j \geq w(i,\ j) \quad \forall (i,\ j) \in E
$$
:::

Any valid set of $u_i$ gives an upper bound on the weight of every matching:

$$
w(M) = \sum_{(i,\ j) \in M} w(i,\ j) \leq \sum_{(i,\ j) \in M} (u_i + u_j) \leq \sum_{i \in V} u_i
$$

The first inequality follows from the dual constraint. The second follows because a matching uses each vertex at most once and every $u_i$ is nonnegative. This is called **weak duality**. If the matching and the dual have the same value, neither can be improved, so both are optimal.

The conditions that make those values equal are called **complementary slackness**. For this initial relaxation, every matched edge must be **tight**, meaning $u_i + u_j = w(i,\ j)$. Any unmatched vertex must have $u_i = 0$. This is enough for bipartite matching and is the same basic idea used by the Hungarian algorithm.

This gives us a way to prove optimality instead of just finding a matching that looks good. If we find a matching of weight $W$ and a feasible choice of the $u_i$ that also sums to $W$, weak duality leaves no room for a heavier matching. The matching and the dual solution certify each other.

#### Odd-set constraints

Our student graph is not bipartite, so the relaxed program still has a problem. Take a triangle whose edges all have weight $1$. Setting $x_e = 1/2$ on all three edges satisfies every degree constraint and gives a total weight of $3/2$. A real matching can only contain one of the three edges, so its maximum weight is $1$.

Edmonds fixed this by adding a constraint for every odd set of vertices. If $S$ has $2s + 1$ vertices, a matching can contain at most $s$ edges whose endpoints are both in $S$:

$$
\sum_{\substack{e = (i,\ j) \in E \\ i,\ j \in S}} x_e \leq \frac{|S| - 1}{2}
$$

Each odd-set constraint adds another dual variable $z_S \geq 0$. The full dual objective and edge constraint become:

$$
\textrm{minimize} \quad
\sum_{i \in V} u_i +
\sum_{\substack{S \subseteq V \\ |S| \text{ odd}}}
\frac{|S| - 1}{2}z_S
$$

$$
u_i + u_j + \sum_{S \supseteq \{i,\ j\}} z_S \geq w(i,\ j)
\quad \forall (i,\ j) \in E
$$

For the triangle, let $S$ contain all three vertices. The new constraint says that the three edge variables can sum to at most $1$, so the fractional solution above is no longer feasible. On the dual side, we can set every $u_i$ to $0$ and set $z_S = 1$. The dual objective is then $1$, exactly the value of the best real matching.

This is also why blossoms appear in the weighted algorithm. It stores the odd sets it currently needs as blossoms (including nested subblossoms) instead of explicitly keeping a variable for every possible odd set.

With the odd-set variables included, the slack of an edge is:

$$
\pi_{ij} =
u_i + u_j +
\sum_{S \supseteq \{i,\ j\}} z_S -
w(i,\ j)
$$

An edge is tight when $\pi_{ij} = 0$. Complementary slackness now requires matched edges to be tight, unmatched vertices to have $u_i = 0$, and every odd set with $z_S > 0$ to contain exactly $(|S| - 1)/2$ matched edges. The last condition is why a blossom with a positive $z_S$ must remain full.

#### Updating the dual variables

The weighted algorithm runs the usual alternating-tree search, but it only follows tight edges. It contracts and expands blossoms during the search as before. If it finds an augmenting path, it swaps the matched and unmatched edges along that path. If the search gets stuck, it changes the dual variables until another edge becomes tight or a blossom can be expanded.

It starts with $M = \emptyset$ and every $z_S = 0$. If $W$ is the largest edge weight, setting every $u_i = W/2$ satisfies the dual constraints because $u_i + u_j = W \geq w(i,\ j)$. All of the weights in this challenge are nonnegative, so this is a valid starting point.

Vertices and blossoms at even depth in the search forest are labeled $S$, while those at odd depth are labeled $T$. Every exposed root starts with an $S$ label. A dual update subtracts $\delta$ from each $S$-vertex's $u_i$ and adds $\delta$ to each $T$-vertex's $u_i$. It also adds $2\delta$ to the $z_S$ of each top-level $S$-blossom and subtracts $2\delta$ from each top-level $T$-blossom. These changes preserve the slack of the matched edges in the forest.

The update still has to keep every dual variable and every edge slack valid. This is where the four values in Galil's screenshot come from.

1. $\delta_1$ is the smallest $u_i$ among the $S$-vertices. If this is the minimum, the ordinary maximum weight search has reached its optimum and terminates.
2. $\delta_2$ is the smallest $\pi_{ij}$ on an edge from an $S$-vertex to an unlabeled vertex. That edge becomes tight, so the alternating tree can grow.
3. $\delta_3$ is half the smallest $\pi_{ij}$ on an edge between two $S$-blossoms. Both endpoints lose $\delta$, which is why the slack is divided by two. The new tight edge either produces an augmenting path or forms another blossom.
4. $\delta_4$ is half the smallest $z_S$ among the top-level $T$-blossoms. A $T$-blossom loses $2\delta$, so this is when one of those variables reaches $0$ and the blossom can be expanded.

The algorithm chooses $\delta = \min(\delta_1,\ \delta_2,\ \delta_3,\ \delta_4)$, performs the corresponding update, and continues the search. Galil's $u_i$ are the vertex dual variables, $\pi_{ij}$ is edge slack, and $z_k$ belongs to a blossom. The right side of the screenshot discusses how to maintain $\delta_2$ and $\delta_3$ efficiently enough to reach the $\mathcal{O}(|V|^3)$ running time.

:::remark[Why `maxcardinality=True{:py}` matters]
The challenge expects <u>every student</u> to be paired, even if one pair gives a total score of $0$. Our graph is complete and has an even number of vertices, so a maximum-cardinality matching is also a perfect matching. The `maxcardinality=True{:py}` argument tells NetworkX to find the heaviest matching among all maximum-cardinality matchings.

As an implementation detail, NetworkX omits the normal $\delta_1$ limit in this mode, so its vertex dual variables may become negative. This does not contradict the $u_i \geq 0$ constraint above because fixing the cardinality changes the dual problem being solved.
:::

### "Borrowing" an implementation

Yes, the blossom algorithm is the most elegant thing I've ever seen. No, I am absolutely never going to implement it from scratch. I'm not even going to try. Yes, it's super fun to visualize and understand the concepts, but could you even imagine trying to implement this in code, and deal with "neighbors" and "forests" and "visited nodes?" I can't.

Currently, we have tried two implementations which work for this challenge in Python 3.9: [van Rantwijk's](http://jorisvr.nl/article/maximum-matching), and the [NetworkX](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.matching.max_weight_matching.html) Python library. Both run in $\mathcal{O}(n^3)$ time, which is still reasonable for our range of $50 < N < 100$, $N \bmod 2 = 0$. [Duan and Pettie](https://web.eecs.umich.edu/~pettie/papers/ApproxMWM-JACM.pdf) overview an approximate method for maximum weight matching, which runs in linear time.

We'll begin by parsing the input.

#### Parsing input

Let's start with a quick recap of what the netcat server gave us. We have $N$ lines, with $N$ representing the amount of students in the classroom (in addition to being an even amount). Each line will contain $N - 1$ integers $R$ representing the rating that student has for the individual at that index (accommodating for the skipped index representing themselves).

We can pass the input into a variable `data{:py}` with [`pwntools{:py}`](https://docs.pwntools.com/en/stable/tubes.html#pwnlib.tubes.tube.tube.recvuntilS)'s `recvuntilS{:py}` method, which will receive data until it sees the specified string. We'll use `b'> '{:py}` as the string to stop at, since that's the prompt the server gives us.

Once we have the data, let's convert it into something we can work with — we'll make a 2D matrix so we can access both the student and their rating of another. We should also insert a 0 at the index which the student skipped themselves so the matchings don't get screwed up:

~~~py title="`matchmaker.py{:file}`"
from pwn import remote

def parse_input(data):
    # [:-1] Removes the trailing '> '
    data = data.splitlines()[:-1]
    data = [x.split() for x in data]
    table = [[int(x) for x in row] for row in data]
    # Insert 0 at the index which the student skipped themselves
    for i in range(len(data)):
        table[i].insert(i, 0)
    return table

p = remote('0.cloud.chals.io', [PORT])
data = parse_input(p.recvuntilS(b'> '))
print(data)
~~~

Let's do some premature optimization and type hinting because I'm a nerd:

~~~py title="`matchmaker.py{:file}`"
from pwn import remote

def parse_input(data: str) -> list[list[int]]:
    data = [list(map(int, x.split())) for x in data.splitlines()[:-1]]
    [data[i].insert(i, 0) for i in range(len(data))]
    return data

def main() -> None:
    p = remote('0.cloud.chals.io', [PORT])
    data = parse_input(p.recvuntilS(b'> '))
    print(data)

if __name__ == '__main__':
    main()
~~~

Testing the script:

```ansi
[0;33m$[0m python3 matchmaker.py
[[0;32m+[0m] Opening connection to 0.cloud.chals.io on port [PORT]: Done
[[0, 39, 79, 40, 92, 6, 36, 10, 23, 53, 22, 1, 95, 23, 28, 53, 12, 19, 21, 89, 91, 17, 1, 45, 9, 37, 97, 68, 40, 96, 69, 17, 50, 98, 79, 33, 44, 18, 38, 31, 33, 84, 94, 64, 11, 64, 24, 82, 25, 0, 72, 99, 51, 58, 85, 60, 81, 68, 68, 93, 73, 51, 84, 56, 19, 48, 5, 69, 38, 55, 74, 81, 41, 0, 64, 42, 1, 60, 47, 89, 64, 26, 96, 10], [3, 0, 8, 70, 90, 46, 65, 81, 94, 86, 22, 56, 48, 66, 0, 13, 73, 61, 71, 86, 25, 98, 40, 58, 79, 84, 80, 99, 17, 75, 60, 74, 39, 18, 77, 4, 63, 96, 29, 68, 54, 44, 2, 48, 59, 34, 24, 18, 95, 13, 3, 53, 40, 70, 28, 60, 13, 59, 72, 74, 47, 30, 94, 48, 82, 61, 58, 41, 84, 88, 67, 64, 8, 0, 97, 22, 86, 2, 93, 4, 55, 53, 15, 70],
```

Nice. Let's move on to the actual algorithm.

#### Maximum weight matching

This solve utilizes the [NetworkX](https://networkx.org/) library's [`algorithms.matching.max_weight_matching`](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.matching.max_weight_matching.html) function, which takes a NetworkX `Graph` class as input (the equivalent of $G$) and returns a set of tuples (e.g. `{(29, 14), (48, 21), (0, 39), (23, 19), ...}{:py}`) representing the endpoints of the edges in $M$.

We'll import `networkx.algorithms.matching{:py}` as `matching{:py}` for our blossom algorithm wrapper, and `networkx{:py}` as `nx{:py}` for our `Graph{:py}` class. In terms of weight, we need to convert the students' ratings into "biweights" (e.g. $w(0, 1) + w(1, 0)$) because the ratings they have for each other aren't necessarily symmetric:

![Biweight](./assets/biweight.svg)

Each "biweight" now represents the total score of the match, which was mentioned in the author's notes. We'll be able to pass this into the `max_weight_matching(){:py}` function as the `weight{:py}` parameter.

To test the algorithm, we'll use the following dummy input (note that inverse repetition is allowed):

```yml
Input: [[0, 0, 100, 0], [0, 100, 0, 0], [0, 100, 0, 0], [100, 0, 0, 0]]
Expected Output: [(0, 3), (1, 2), (2, 1), (3, 0)]
```

In theory, the following script should pair the zeroth student with the third student, and the first student with the second:

~~~py title="`matchmaker.py{:file}`" ins={2-3,13-17} del={1,11-12,18}
from pwn import remote
import networkx as nx
import networkx.algorithms.matching as matching

def parse_input(data: str) -> list[list[int]]:
    data = [list(map(int, x.split())) for x in data.splitlines()[:-1]]
    [data[i].insert(i, 0) for i in range(len(data))]
    return data
 
def main() -> None:
    p = remote('0.cloud.chals.io', [PORT])
    data = parse_input(p.recvuntilS(b'> '))
    data = [[0, 0, 100, 0], [0, 100, 0, 0], [0, 100, 0, 0], [100, 0, 0, 0]]
    G: nx.Graph = nx.Graph([(i, j, {'weight': data[i][j] + data[j][i]}) for i in range(len(data)) for j in range(len(data[i])) if i != j])
    M: set[tuple] = matching.max_weight_matching(G, maxcardinality=True)
    M_S: list[tuple] = sorted(list(M) + [(b, a) for a, b in M])
    print(data)
    print(M_S)

if __name__ == '__main__':
    main()
~~~

Testing the script:

```ansi
[0;33m$[0m python3 matchmaker.py
[(0, 3), (1, 2), (2, 1), (3, 0)]
```

The script works locally! Let's alter it to include the three iterations (alongside the correct formatting, e.g. `0,3;1,2;2,1;3,0;4,5;5,4{:py}`) so that it can work with the remote server:

~~~py title="`matchmaker.py{:file}`" ins={1,11-12,14,18,20,22} del={13,19}
from pwn import remote
import networkx as nx
import networkx.algorithms.matching as matching

def parse_input(data: str) -> list[list[int]]:
    data = [list(map(int, x.split())) for x in data.splitlines()[:-1]]
    [data[i].insert(i, 0) for i in range(len(data))]
    return data

def main() -> None:
    p = remote('0.cloud.chals.io', [PORT])
    for _ in range(3):
        data = [[0, 0, 100, 0], [0, 100, 0, 0], [0, 100, 0, 0], [100, 0, 0, 0]]
        data = parse_input(p.recvuntilS(b'> '))
        G: nx.Graph = nx.Graph([(i, j, {'weight': data[i][j] + data[j][i]}) for i in range(len(data)) for j in range(len(data[i])) if i != j])
        M: set[tuple] = matching.max_weight_matching(G, maxcardinality=True)
        M_S: list[tuple] = sorted(list(M) + [(b, a) for a, b in M])
        result: str = ';'.join([f'{a},{b}' for a, b in M_S])
        print(data)
        p.sendline(result.encode())

    p.interactive()

if __name__ == '__main__':
    main()
~~~

Running the script:

```ansi mark="valentine{l0V3_i5_1n_7he_4ir}"
[0;33m$[0m python3 matchmaker.py
[[0;32m+[0m] Opening connection to 0.cloud.chals.io on port [PORT]: Done
[[0;34m*[0m] Switching to interactive mode
Congratulations! Here's your valentine: valentine{l0V3_i5_1n_7he_4ir}
[[0;34m*[0m] Got EOF while reading in interactive
```

We've successfully performed a maximum weight matching utilizing the blossom algorithm and the primal-dual method!

## Afterword

Wow, this challenge was definitely a rabbit hole. Even though the author never actually intended for us to go this deep into the math behind it (and for me to skip out on my Calculus classes to learn graph theory and discrete math), I really don't like ignoring concepts (or in this case, a wrapper function) simply because their prerequisite knowledge floors are either too high or too intimidating. Obviously I was a lost sheep when I was initially researching the blossom algorithm (as this is my first algo challenge, ever), but I just love the feeling when you tear through all the layers of abstraction and finally get to the juicy, low-level bits.

I'm glad that our team was able to get first blood on this one, and I'm glad this beautiful algorithm was the first one I've learned. I hope you enjoyed this writeup, and I hope you learned something new!

### References

| Author(s) | Title | Year |
|-----------|-------|------|
| Anstee (UBC) | [MATH 523: Primal-Dual Maximum Weight Matching Algorithm](https://personal.math.ubc.ca/~anstee/math523/523Matching.pdf) | 2012 |
| Bader (TUM) | [Fundamental Algorithms, Chapter 9: Weighted Graphs](https://www5.in.tum.de/lehre/vorlesungen/fundalg/WS11/fundalg09.pdf) | 2011 |
| Brilliant | [Blossom Algorithm](https://brilliant.org/wiki/blossom-algorithm/) | - |
| Wikipedia | [Blossom Algorithm](https://en.wikipedia.org/wiki/Blossom_algorithm) | - |
| Chakrabarti (Dartmouth) | [Maximum Matching](https://www.cs.dartmouth.edu/~ac/Teach/CS105-Winter05/Notes/kavathekar-scribe.pdf) | 2005 |
| Duan, Pettie | [Linear-Time Approximation for Maximum Weight Matching](https://web.eecs.umich.edu/~pettie/papers/ApproxMWM-JACM.pdf) | 2014 |
| Galil | [Efficient Algorithms for Finding Maximum Matching in Graphs](https://web.archive.org/web/20201126210546/http://www.cs.kent.edu/~dragan/GraphAn/p23-galil.pdf) | 1986 |
| Goemans (MIT) | [1. Lecture notes on bipartite matching](https://math.mit.edu/~goemans/18433S09/matching-notes.pdf) | 2009 |
| Goemans (MIT) | [2. Lecture notes on non-bipartite matching](https://math.mit.edu/~goemans/18433S15/matching-nonbip-notes.pdf) | 2015 |
| Karp (UC Berkeley) | [Edmonds's Non-Bipartite Matching Algorithm](https://web.archive.org/web/20081230183603/http://www.cs.berkeley.edu/~karp/greatalgo/lecture05.pdf) | 2006 |
| Monogon | [Blossom Algorithm for General Matching in O(n^3)](https://codeforces.com/blog/entry/92339) | 2021 |
| NetworkX | [Documentation](https://networkx.org/documentation/stable/reference/algorithms/matching.html) | - |
| Radcliffe (CMU) | [Math 301: Matchings in Graphs](https://www.math.cmu.edu/~mradclif/teaching/301F15/Matchings.pdf) | - |
| Shoemaker, Vare | [Edmonds' Blossom Algorithm](https://stanford.edu/~rezab/classes/cme323/S16/projects_reports/shoemaker_vare.pdf) | 2016 |
| Sláma | [The Blossom algorithm](https://www.youtube.com/watch?v=3roPs1Bvg1Q) | 2021 |
| Stein (Columbia) | [Handouts - Matchings](http://www.columbia.edu/~cs2035/courses/ieor6614.S16/index.html) | 2016 |
| Vazirani (UC Berkeley) | [Lecture 3: Maximum Weighted Matchings](https://people.eecs.berkeley.edu/~satishr/cs270/sp11/rough-notes/matching.pdf) | - |
| van Rantwijk | [Maximum Weighted Matching](http://jorisvr.nl/article/maximum-matching) | 2008 |

<style>
challenge-info {
  --row-border: color-mix(in oklab, var(--muted-foreground) 30%, transparent);

  display: block;
  margin-block: 0 1em;
  padding: var(--space-xs) var(--space-s);
  border: 2px solid var(--border);
  font-size: var(--step--1);

  challenge-title {
    display: block;
    padding-block-end: var(--space-3xs);
    color: var(--foreground);
    font-weight: var(--font-weight-medium);
  }

  dl {
    display: flex;
    flex-direction: column;
    margin-block: 0;

    > div {
      display: flex;
      align-items: baseline;
      gap: var(--space-s);
      padding-block: var(--space-3xs);

      &:not(:last-child) {
        border-block-end: 1.5px solid var(--row-border);
      }
    }
  }

  dt {
    flex: 1;
    color: var(--muted-foreground);
    font-weight: var(--font-weight-medium);
  }

  dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3xs);
    flex: 2;
    margin: 0;
    word-break: break-word;

    img {
      display: inline-block;
      margin: 0;
      border-radius: var(--radius-full);
      inline-size: 1em;
      block-size: 1em;
    }

    a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    > p {
      margin-block: 0;
    }
  }

  > dl + p,
  > dl ~ * {
    margin-block: var(--space-2xs) 0;
  }
}

challenge-flag {
  word-break: break-all;
  filter: blur(4px);
  transition: filter 0.2s;
  user-select: all;

  &:hover {
    filter: none;
  }
}
</style>
