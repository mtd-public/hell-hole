// The depths, as ASCII maps. One character per 3 m cell (TUNING.cell); row 0 is north.
//
//   #  wall                         .  corridor floor (low ceiling)   ,  room floor (high ceiling)
//   O  papyrus column (room)        b  bronze brazier (room, solid)   t / T  torch on an adjacent wall
//   P  start (facing north)         D  the way down: the scarab door  a  ankh shrine on an adjacent wall
//   m  the Wrapped (mummy)          s  scarab nest                    k  .45 ammo
//   r  the squad's Remington 870    e  12-gauge shells                g  a crate of Mk 2 grenades (1940s)
//
// tools/sim-check.mjs proves every map: the door is reachable from the start, every pickup too.

export const DEPTHS = [
  {
    id: 'depth1',
    name: 'Depth I',
    title: 'The Descending Corridor',
    blurb: 'Your squad went in an hour ahead of you. The radio went quiet at the second chamber.',
    map: [
      '########################',
      '##########D#############',
      '##########t#############',
      '###,,,,,T,,,T,,,,,######',
      '###,m,b,,,,,,,b,,k######',
      '###,,O,,Om,,O,,O,,######',
      '###a,,,,,,,,,,,,m,######',
      '###,s,,,,,,m,,,,,,######',
      '###,,O,,O,,,O,,Os,######',
      '###,,,b,,,,,,mb,,,...###',
      '###k,,,,,,,,,,,,,g##.###',
      '######.#############t###',
      '######s#############m###',
      '######t#############.###',
      '######.#############.###',
      '##,,,,,,,,T#########t###',
      '##,O,,m,,O,#########.###',
      '##,,,,,,,,,########..e##',
      '##,mb,,,b,,.t.s.t....r##',
      '##,,,,,,,,,########t.k##',
      '##,O,,,,mO,#############',
      '##k,,,,,,,,#############',
      '#####m##################',
      '#####.##################',
      '#####t##################',
      '#####k##################',
      '#####.##################',
      '#####t##################',
      '#####P##################',
      '########################',
      '########################',
    ],
  },
];
