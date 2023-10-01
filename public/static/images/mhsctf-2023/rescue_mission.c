#include <stdio.h>
#include <stdlib.h>
#include <time.h>

typedef struct {
  int health;
  int attack;
  int priority;
} entity;

entity player = {100, 3, 4};
entity boss = {1, 250, -1};
int money = 15;

void clear() { printf("\e[1;1H\e[2J"); }

int doBattle(entity player, entity enemy) {
  int turn = player.priority > enemy.priority;
  int health[2] = {player.health, enemy.health};
  while (health[0] > 0 && health[1] > 0) {
    if (turn == 0) {
      clear();
      printf("Player, your turn!\nYOUR "
             "STATS:\nHP\t\tATK\t\tPRI\n%i\t\t%i\t\t%i\n\n",
             health[0], player.attack, player.priority);
      printf("OPPONENT STATS:\nHP\t\tATK\t\tPRI\n%i\t\t%i\t\t%i\n\n\nPress "
             "[ENTER] to play turn...",
             health[1], enemy.attack, enemy.priority);
      getchar();
      printf("\n#(1-%i): ", player.attack);
      int pnum;
      scanf("%i", &pnum);
      int anum = rand() % player.attack + 1;
      printf("\nYour #: %i\t\tAttacker #: %i", pnum, anum);
      if (pnum == anum) {
        printf("\n\nATTACK BLOCKED!");
      } else {
        int damage = rand() % (player.attack * 2) + player.attack * 2;
        printf("\n\nHIT! (%i)", damage);
        health[1] -= damage;
      }
      getchar();
      getchar();
    } else if (turn == 1) {
      clear();
      printf("Enemy turn!\nYOUR STATS:\nHP\t\tATK\t\tPRI\n%i\t\t%i\t\t%i\n\n",
             health[0], player.attack, player.priority);
      printf("OPPONENT STATS:\nHP\t\tATK\t\tPRI\n%i\t\t%i\t\t%i\n\n\nPress "
             "[ENTER] to play turn...",
             health[1], enemy.attack, enemy.priority);
      getchar();
      printf("\n#(1-%i): ", enemy.attack);
      int pnum;
      scanf("%i", &pnum);
      int anum = rand() % enemy.attack + 1;
      printf("\nYour #: %i\t\tAttacker #: %i", pnum, anum);
      if (pnum == anum && enemy.health != boss.health) {
        printf("\n\nATTACK BLOCKED!");
      } else {
        int damage = rand() % (enemy.attack * 2) + enemy.attack * 2;
        printf("\n\nHIT! (%i)", damage);
        health[0] -= damage;
      }
      getchar();
      getchar();
    }
    turn = (turn + 1) % 2;
  }
  if (health[0] <= 0) {
    return 0;
  }
  return enemy.health / 10 + enemy.attack - enemy.priority;
}

void doShop() {
  int done = 0;
  while (!done) {
    clear();
    printf("SHOP ($%i)\n\n0. Leave Shop\n1. HP  Upgrade\n2. ATK Upgrade\n3. "
           "PRI Upgrade\n\n",
           money);
    int selection;
    char quantity[20];
    scanf("%i", &selection);
    if (selection == 0) {
      done = 1;
    } else if (selection == 1) {
      clear();
      printf("HP Upgrade ($%i)\n\n1. +3 HP  ($5)\n2. +15 HP ($20)\n3. +50 HP "
             "($50)\n\n",
             money);
      scanf("%i", &selection);
      printf("Quantity? ");
      scanf("%s", &quantity);
      int price;
      int buff;
      if (selection == 1) {
        price = 5;
        buff = 3;
      } else if (selection == 2) {
        price = 20;
        buff = 15;
      } else if (selection == 3) {
        price = 50;
        buff = 50;
      } else {
        price = 0;
        buff = 0;
      }
      int qint = atoi(quantity);
      if (quantity[0] == '-') {
        qint *= -1;
      }
      int cost = qint * price;
      printf("\n\nTotal Price: $%i", cost);
      if (cost > money) {
        printf("\nNOT ENOUGH MONEY!\n\n");
        getchar();
        getchar();
      } else {
        money -= cost;
        player.health += buff * qint;
        printf("\nYou have $%i left.\n\n", money);
        getchar();
        getchar();
      }
    } else if (selection == 2) {
      clear();
      printf("ATK Upgrade ($%i)\n\n1. +1 ATK  ($10)\n\n", money);
      printf("Quantity? ");
      scanf("%s", &quantity);
      int price = 10;
      int buff = 1;
      int qint = atoi(quantity);
      if (quantity[0] == '-') {
        qint *= -1;
      }
      int cost = qint * price;
      printf("\n\nTotal Price: $%i", cost);
      if (cost > money) {
        printf("\nNOT ENOUGH MONEY!\n\n");
        getchar();
        getchar();
      } else {
        money -= cost;
        player.attack += buff * qint;
        printf("\nYou have $%i left.\n\n", money);
        getchar();
        getchar();
      }
    } else if (selection == 3) {
      clear();
      printf("PRI Upgrade ($%i)\n\n1. -1 PRI  ($20)\n\n", money);
      printf("Quantity? ");
      scanf("%s", &quantity);
      int price = 20;
      int buff = 1;
      int qint = atoi(quantity);
      if (quantity[0] == '-') {
        qint *= -1;
      }
      int cost = qint * price;
      printf("\n\nTotal Price: $%i", cost);
      if (cost > money) {
        printf("\nNOT ENOUGH MONEY!\n\n");
        getchar();
        getchar();
      } else {
        money -= cost;
        player.priority -= buff * qint;
        printf("\nYou have $%i left.\n\n", money);
        getchar();
        getchar();
      }
    }
  }
}

int main(void) {
  srand(time(NULL));
  clear();
  printf("Welcome to...\n");
  printf("...the MHSCTF BATTLE ARENA!\n[ENTER]");
  getchar();
  for (int i = 0; i < 3; i++) {
    doShop(money);
    entity enemy = {rand() % 100 + 50, rand() % 3 + 3, rand() % 10};
    int earned = doBattle(player, enemy);
    if (earned > 0) {
      printf("\n\nYOU WIN! +%i coins", earned);
      money += earned;
      getchar();
    } else {
      printf("\n\nENEMY WINS!");
      getchar();
    }
  }
  money = 15;
  printf("BOSS FIGHT TIME!\n\n");
  getchar();
  getchar();
  doShop();
  if (doBattle(player, boss)) {
    clear();
    printf("YOU SAVED ALEX!\n\n");
    printf("Here's your flag: [REDACTED]\n\n");
  }
  return 0;
}
