// =============================================================================
// WORLD 1-1 — NES-ACCURATE LEVEL DATA
// =============================================================================
// Legend:
// (space) = Air
// # = Ground/Hard Block
// B = Brick
// ? = Question Block (Coin)
// M = Question Block (Mushroom/Fire Flower)
// S = Question Block (Star)
// | = Pipe Body
// [ = Pipe Top Left
// ] = Pipe Top Right
// G = Goomba spawn
// K = Koopa spawn
// F = Flagpole Base
// T = Flagpole Top

const mapString = [
"                                                                                                                                                                                                                                                        ",
"                                                                                                                                                                                                                                                        ",
"                                                                                                                                                                                                                                                        ",
"                                                                                                                                                                                                                                                        ",
"                                                                                                                                                                                                                                                        ",
"                                   ?                                                                                                                                                                                                                    ",
"                                 #B?B#                                                                                                                                                                                                                  ",
"                                 #   #                                                                                                                                                                                                                  ",
"                                                                                                                                                                                                                                                        ",
"                  M   B?B?B   ?  ?   ?                                                                                                                    T                                                                                         ",
"                G   G       G                           []      []      []       G    G   G   G         BBM B            BB  B?B   B?B     []              |                                                                                         ",
"                                                      []||    []||    []||                            BB  BB            BB              []||              |                                                                                         ",
"                    G                                 ||||    ||||    ||||                  G         BB  BB            BB              ||||              |                                                                                         ",
"######################################################||||####||||####||||############################BB  BB############BB##############||||##############F#########################################################################################",
"######################################################||||####||||####||||############################BB  BB############BB##############||||##############F#########################################################################################",
];

// Block content types (must match types.ts BlockContent enum)
const CONTENT_COIN = 1;
const CONTENT_MUSHROOM = 3;

export const getLevelData = () => {
    const rows = mapString.length;
    const cols = mapString[0].length;
    const tiles: number[][] = [];
    const entities: { type: string; x: number; y: number }[] = [];
    const blocks: { x: number; y: number; content: number }[] = [];

    // Initialize empty tile grid
    for (let y = 0; y < rows; y++) {
        tiles[y] = new Array(cols).fill(0);
    }

    // Parse map
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const char = mapString[y][x];
            let tileId = 0;

            switch (char) {
                case '#': 
                    tileId = 1; // Ground
                    break;
                case 'B': 
                    tileId = 2; // Brick
                    break;
                case '?': 
                    tileId = 4; // Question Block (Coin)
                    blocks.push({ x, y, content: CONTENT_COIN });
                    break;
                case 'M': 
                    tileId = 4; // Question Block (Mushroom)
                    blocks.push({ x, y, content: CONTENT_MUSHROOM });
                    break;
                case 'S':
                    tileId = 4; // Question Block (Star)
                    blocks.push({ x, y, content: 4 }); // Star
                    break;
                case '|': 
                    tileId = 6; // Pipe Body
                    break;
                case '[': 
                    tileId = 8; // Pipe Top Left
                    break;
                case ']': 
                    tileId = 9; // Pipe Top Right
                    break;
                case 'T': 
                    tileId = 11; // Flag Top
                    break;
                case 'F': 
                    tileId = 10; // Flag Pole
                    break;
                case 'G': 
                    entities.push({ type: 'goomba', x: x * 16, y: y * 16 });
                    tileId = 0;
                    break;
                case 'K':
                    entities.push({ type: 'koopa', x: x * 16, y: y * 16 });
                    tileId = 0;
                    break;
                default: 
                    tileId = 0;
                    break;
            }
            tiles[y][x] = tileId;
        }
    }
    
    return {
        width: cols * 16,
        height: 240,
        tiles,
        entities,
        blocks,
    };
};