# Ring Toss

Land rings on the necks of the bottles at the back of the booth before you run
out.

## How to play

- Move the mouse to aim. The crosshair shows where a ring would land, and it
  wobbles from side to side, so time your throw.
- Click to throw a ring. You have 8 rings, thrown one at a time.
- A ring scores when it lands within 10 px of a bottle's neck. A bottle that
  already has a ring on it takes no more.
- The round ends when you are out of rings and the last ring has landed.
- Click again on the game over screen to play another round.

## Scoring

There are three rows of five bottles. Bottles further back score more:

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `toss`, `step`, `landingPoint`,
  `bottleAt`) and the `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
