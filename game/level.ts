// A compressed representation of 1-1
// Space = Air
// # = Ground
// B = Brick
// ? = Question Block (Coin)
// M = Question Block (Mushroom)
// P = Pipe Body
// [ = Pipe Top Left
// ] = Pipe Top Right
// G = Goomba
// K = Koopa
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
"                  ?   B?B?B   ?  ?   ?                                                                                                                    T                                                                                         ",
"                G   G       G                           []      []      []       G    G   G   G         BB?B            BB  B?B   B?B     []              |                                                                                         ",
"                                                      []||    []||    []||                            BB  BB            BB              []||              |                                                                                         ",
"                    G                                 ||||    ||||    ||||                  G         BB  BB            BB              ||||              |                                                                                         ",
"######################################################||||####||||####||||############################BB  BB############BB##############||||##############F#########################################################################################",
"######################################################||||####||||####||||############################BB  BB############BB##############||||##############F#########################################################################################",
];

export const getLevelData = () => {
    // Parse the map string into a 2D array of tiles and entity definitions
    const rows = mapString.length;
    const cols = mapString[0].length;
    const tiles: number[][] = [];
    const entities: any[] = [];

    // Initialize empty tile grid
    for(let y=0; y<rows; y++) {
        tiles[y] = new Array(cols).fill(0);
    }

    // Fill logic
    for(let y=0; y<rows; y++) {
        for(let x=0; x<cols; x++) {
            const char = mapString[y][x];
            let tileId = 0;

            switch(char) {
                case '#': tileId = 1; break; // Ground
                case 'B': tileId = 2; break; // Brick
                case '?': tileId = 4; break; // Question
                case 'M': tileId = 4; break; // Question (Mushroom logic handled by metadata usually, simplifying here)
                case '|': tileId = 6; break; // Pipe Left (simplified visual)
                case '[': tileId = 8; break; // Pipe Top Left
                case ']': tileId = 9; break; // Pipe Top Right
                case 'T': tileId = 11; break; // Flag Top
                case 'F': tileId = 10; break; // Flag Pole
                case 'G': 
                    entities.push({ type: 'goomba', x: x * 16, y: y * 16 });
                    tileId = 0; // Entity is not a tile
                    break;
                case 'K':
                    entities.push({ type: 'koopa', x: x * 16, y: y * 16 });
                    tileId = 0;
                    break;
                default: tileId = 0; break;
            }
            tiles[y][x] = tileId;
        }
    }
    
    // Add floor kill plane
    return {
        width: cols * 16,
        height: 240, // 15 rows * 16
        tiles,
        entities
    };
};