// The depths, as ASCII maps. One character per 3 m cell (TUNING.cell); row 0 is north.
//
//   #  wall                         .  corridor floor (low ceiling)   ,  room floor (high ceiling)
//   O  papyrus column (room)        b  bronze brazier (room, solid)   t / T  torch on an adjacent wall
//   P  start (facing north)         D  the way down: the scarab door  a  ankh shrine on an adjacent wall
//   m  the Wrapped (mummy)          s  scarab nest                    k  .45 ammo
//   r  the squad's Remington 870    e  12-gauge shells                g  a crate of Mk 2 grenades (1940s)
//   j  Jackal Warden                c  Canopic Mother (floating spawner) v  a flock of three ba
//   z  the expedition's bazooka     q  a crate of rockets (1940s)
//
// kit: the loadout for starting at this depth directly (descending from the one above carries
// whatever you had instead).
// tools/sim-check.mjs proves every map: the door is reachable from the start, every pickup too.

export const DEPTHS = [
  {
    id: 'depth1',
    name: 'Depth I',
    title: 'The Descending Corridor',
    blurb: 'Your squad went in an hour ahead of you. The radio went quiet at the second chamber.',
    kit: null,
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
  {
    id: 'depth2',
    name: 'Depth II',
    title: 'Hypostyle of Night',
    blurb: 'Below the scarab door, a forest of columns. A 1940s expedition camped here once. Something still guards the way down.',
    kit: { hp: 100, reserve: 70, shotgun: true, sgTube: 7, shells: 16, grenades: 2 },
    map: [
      '##############################',
      '###############D##############',
      '###############t##############',
      '############b,,,,j,###########',
      '############,,,c,,,###########',
      '############,j,,,,b###########',
      '###############.##############',
      '###############t##############',
      '######,,,T,,,,,,,T,,,,,g######',
      '######,v,,,,b,,,,,,,,,m,######',
      '######,,O,,O,,O,,,O,,O,,######',
      '######,,,,,,,,,c,,,j,,,,##,k,#',
      '######b,,,j,,,,,,,,,,,,,##T,,#',
      '######,,O,,O,,O,,,O,,O,q..,,a#',
      '######,,,,,,,,,,,,,,,,,,##,,,#',
      '######,,,b,,,,,,,,,,b,,,##,e,#',
      '######,,,,,,,j,,,,,,,,v,######',
      '######,mO,,O,,O,,,O,,O,,######',
      '######,,,,,,m,,,j,,,,,,b######',
      '######k,,,,,,,,,,b,,,,,,######',
      '##############.###############',
      '#,,m,#########t###############',
      '#,,,T#########.###############',
      '#,zq,####,,,,,,,,,,,##########',
      '#,,,,####,,O,j,,,O,,##########',
      '#g,,,####,b,,,,,j,b,##########',
      '#,s,,..t.,,,,,,,,,,,##########',
      '#,k,m####,,O,,,,,O,,##########',
      '#b,,,####k,,,,,,,,,e##########',
      '##############k###############',
      '##############.###############',
      '##############t###############',
      '##############.###############',
      '##############P###############',
      '##############################',
    ],
  },
];
