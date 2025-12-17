import React, { useState, useCallback, useRef, useEffect } from 'react';
import Board from './Board';

const CELL_SIZE = 50;
const GRID_GAP = 3;

const Game = () => {
    const [levelData, setLevelData] = useState(null);
    const [pieces, setPieces] = useState([]);
    const [win, setWin] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [fileName, setFileName] = useState('');
    const [isSolving, setIsSolving] = useState(false);
    
    const [timer, setTimer] = useState(0); 
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [solvedLogs, setSolvedLogs] = useState([]); 
    const timerRef = useRef(0); 

    const [exploredCount, setExploredCount] = useState(0);
    const stopSolverRef = useRef(false);


    
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        let interval = null;
        if (isTimerActive && !win) {
            interval = setInterval(() => {
                setTimer(t => {
                    timerRef.current = t + 1;
                    return t + 1;
                });
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isTimerActive, win]);


    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                loadLevel(data);
            } catch (err) {
                alert("Invalid JSON file!");
            }
        };
        reader.readAsText(file);
    };

    const loadLevel = (data) => {
        stopSolverRef.current = true;
        setLevelData(data);
        const initialPieces = data.shapes.map((shape, index) => ({
            id: index,
            ...shape,
            coordinates: shape.coordinates.map(c => ({ row: c[0], col: c[1] }))
        }));
        setPieces(initialPieces);
        setWin(false);
        setShowIntro(false);
        setIsSolving(false);
        setExploredCount(0);
        
        setTimer(0);
        timerRef.current = 0;
        setSolvedLogs([]);
        setIsTimerActive(false); 
    };

    const restartGame = () => {
        stopSolverRef.current = true;
        if (levelData) loadLevel(levelData);
    };

    const newGame = () => {
        stopSolverRef.current = true;
        setShowIntro(true);
        setLevelData(null);
        setPieces([]);
        setWin(false);
        setFileName('');
        setIsSolving(false);
        setExploredCount(0);
        setTimer(0);
        setIsTimerActive(false);
        setSolvedLogs([]);
    };


    const getBoardHash = (piecesList, rows, cols) => {
        const grid = new Int8Array(rows * cols).fill(0);
        for (const p of piecesList) {
            for (const c of p.coordinates) grid[c.row * cols + c.col] = p.id + 1;
        }
        return grid.join('');
    };

    const checkExit = (piece, coords, lvlData) => {
        for (const gate of lvlData.exists) {
            if (piece.colors !== gate.color) continue;
            for (const c of coords) {
                for (const g of gate.coordinates) {
                    if (c.row === g[0] && c.col === g[1]) return true;
                }
            }
        }
        return false;
    };

    const createOccupiedGrid = (piecesList, blocks, rows, cols) => {
        const grid = new Int8Array(rows * cols).fill(0);
        for (const b of blocks) grid[b[0] * cols + b[1]] = 99;
        for (const p of piecesList) {
            for (const c of p.coordinates) grid[c.row * cols + c.col] = p.id + 1;
        }
        return grid;
    };



    const getSuccessors = (currentPieces, lvlData, occupiedGrid) => {
        const successors = [];
        const { rows, cols } = lvlData;

        for (let i = 0; i < currentPieces.length; i++) {
            const p = currentPieces[i];
            
            const dirs = [];
            if (p.direction === 'horizontal') dirs.push({ r: 0, c: 1 }, { r: 0, c: -1 });
            else if (p.direction === 'vertical') dirs.push({ r: 1, c: 0 }, { r: -1, c: 0 });
            else { dirs.push({ r: 0, c: 1 }, { r: 0, c: -1 }, { r: 1, c: 0 }, { r: -1, c: 0 }); }

            for (const d of dirs) {
                const nextCoords = [];
                let isBlocked = false;
                let isOutside = false;

                for (const c of p.coordinates) {
                    const nr = c.row + d.r;
                    const nc = c.col + d.c;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) { isOutside = true; break; }
                    const val = occupiedGrid[nr * cols + nc];
                    if (val > 0 && val !== (p.id + 1)) { isBlocked = true; break; }
                    nextCoords.push({ row: nr, col: nc });
                }

                if (!isOutside && !isBlocked) {
                    if (checkExit(p, nextCoords, lvlData)) {
                        const newPieces = [...currentPieces];
                        newPieces.splice(i, 1);
                        successors.push({ pieces: newPieces });
                    } else {
                        const newPieces = [...currentPieces];
                        newPieces[i] = { ...p, coordinates: nextCoords };
                        successors.push({ pieces: newPieces });
                    }
                }
            }
        }
        return successors;
    };

    const solveGame = async (algorithm) => {
        if (!levelData || pieces.length === 0) return;
        
        stopSolverRef.current = false;
        setIsSolving(true);
        setExploredCount(0);
        
        setTimer(0);
        timerRef.current = 0;
        setSolvedLogs([]);
        setIsTimerActive(true); 
        

        await new Promise(r => setTimeout(r, 50));

        const queue = [{ pieces: pieces, path: [] }];
        const stack = [{ pieces: pieces, path: [] }];
        const visited = new Set();
        visited.add(getBoardHash(pieces, levelData.rows, levelData.cols));

        let iterations = 0;
        const container = algorithm === 'BFS' ? queue : stack;
        const MAX_ITERATIONS = 500000;

        while (container.length > 0) {
            iterations++;

            if (iterations % 500 === 0) {
                setExploredCount(iterations);
                await new Promise(r => setTimeout(r, 0));
                if (stopSolverRef.current) { setIsSolving(false); return; }
            }

            if (iterations > MAX_ITERATIONS) {
                alert(`Limit Reached (${iterations})`);
                setIsSolving(false);
                setIsTimerActive(false); 
                return;
            }

            const current = algorithm === 'BFS' ? container.shift() : container.pop();

            if (current.pieces.length === 0) {
                setExploredCount(iterations);
                animateSolution(current.path);
                return;
            }

            const grid = createOccupiedGrid(current.pieces, levelData.blocks, levelData.rows, levelData.cols);
            const successors = getSuccessors(current.pieces, levelData, grid);

            for (const succ of successors) {
                const stateHash = getBoardHash(succ.pieces, levelData.rows, levelData.cols);
                if (!visited.has(stateHash)) {
                    visited.add(stateHash);
                    container.push({ pieces: succ.pieces, path: [...current.path, succ.pieces] });
                }
            }
        }

        alert("No Solution Found");
        setIsSolving(false);
        setIsTimerActive(false);
    };

    const animateSolution = (path) => {
        let index = 0;
        const interval = setInterval(() => {
            if (stopSolverRef.current) { clearInterval(interval); return; }
            
            if (index >= path.length) {
                clearInterval(interval);
                setWin(true);
                setIsSolving(false);
                setIsTimerActive(false);
                return;
            }

            const nextPieces = path[index];
            
            let prevPieces = [];
            if (index > 0) {
                prevPieces = path[index - 1];
                if (nextPieces.length < prevPieces.length) {
                    const missing = prevPieces.find(p => !nextPieces.find(np => np.id === p.id));
                    if (missing) {
                        const currentTime = formatTime(timerRef.current);
                        setSolvedLogs(prev => [...prev, { 
                            id: missing.id, 
                            color: missing.colors, 
                            time: currentTime 
                        }]);
                    }
                }
            }

            setPieces(nextPieces);
            index++;
        }, 150);
    };

    
    const handlePieceSlide = useCallback((pieceId, deltaX, deltaY) => {
        if (win || isSolving) return;
        const piece = pieces.find(p => p.id === pieceId);
        if (!piece) return;

        const totalSize = CELL_SIZE + GRID_GAP;
        let dRow = Math.round(deltaY / totalSize);
        let dCol = Math.round(deltaX / totalSize);

        if (piece.direction === 'horizontal') dRow = 0;
        else if (piece.direction === 'vertical') dCol = 0;
        else { if (Math.abs(dRow) > Math.abs(dCol)) dCol = 0; else dRow = 0; }

        if (dRow === 0 && dCol === 0) return;

        const stepR = Math.sign(dRow);
        const stepC = Math.sign(dCol);
        
        const grid = createOccupiedGrid(pieces, levelData.blocks, levelData.rows, levelData.cols);
        for(const c of piece.coordinates) grid[c.row * levelData.cols + c.col] = 0;

        const nextCoords = piece.coordinates.map(c => ({ row: c.row + stepR, col: c.col + stepC }));
        
        let blocked = false;
        for (const c of nextCoords) {
            if (c.row < 0 || c.row >= levelData.rows || c.col < 0 || c.col >= levelData.cols) { blocked = true; break; }
            if (grid[c.row * levelData.cols + c.col] !== 0) { blocked = true; break; }
        }

        if (!blocked) {
            if (checkExit(piece, nextCoords, levelData)) {
               
                const currentTime = formatTime(timer);
                setSolvedLogs(prev => [...prev, { 
                    id: piece.id, 
                    color: piece.colors, 
                    time: currentTime 
                }]);

                const rem = pieces.filter(p => p.id !== pieceId);
                setPieces(rem);
                if (rem.length === 0) {
                    setWin(true);
                    setIsTimerActive(false);
                }
            } else {
                setPieces(pieces.map(p => p.id === pieceId ? { ...p, coordinates: nextCoords } : p));
            }
        }
    }, [pieces, levelData, win, isSolving, timer]);

    return (
        <div className="game-master" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {showIntro ? (
                <div className="intro-overlay">
                    <div className="intro-card">
                        <h1 className="game-title">Unblock Jam</h1>
                        <p className="game-tagline">A smart and fun puzzle game</p>
                        <p className="game-info">
                            Move the colored pieces toward the gates with the matching color<br />
                            When a piece aligns perfectly with its matching gate... it disappears!
                        </p>
                        <label className="file-upload-label">
                            <input type="file" accept=".json" onChange={handleFileUpload} />
                            <span className="file-upload-btn">
                                {fileName ? `Selected: ${fileName}` : 'Choose level file (.json)'}
                            </span>
                        </label>
                        <p>by Ahmad Esmail</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="game-header" style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
                        <h1 className="game-title">Unblock Jam</h1>

                        {fileName && <p className="level-name">level file : {fileName}</p>}
                        
                        <div className="solver-controls" style={{display:'flex', gap:'10px', justifyContent:'center', marginTop: '20px'}}>
                            <button onClick={() => solveGame('BFS')} disabled={isSolving || win} style={btnStyle('#4CAF50')}>
                                Solve BFS
                            </button>
                            <button onClick={() => solveGame('DFS')} disabled={isSolving || win} style={btnStyle('#2196F3')}>
                                Solve DFS
                            </button>
                            <button onClick={restartGame} disabled={isSolving} style={btnStyle('#f44336')}>
                                Restart
                            </button>
                            <button onClick={newGame} style={btnStyle('#FF9800')}>
                                New Level
                            </button>
                        </div>
                        {isSolving && (
                            <div style={{marginTop: '10px', color: '#333'}}>
                                <p style={{fontWeight: 'bold', color: '#E91E63'}}>🤖 AI is thinking...</p>
                                <p>States Explored: {exploredCount}</p>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginTop: '20px' }}>
                        {/* لوحة اللعب */}
                        <Board
                            rows={levelData.rows}
                            cols={levelData.cols}
                            pieces={pieces}
                            blocks={levelData.blocks.map(b => ({ row: b[0], col: b[1] }))}
                            gates={levelData.exists}
                            onPieceSlide={handlePieceSlide}
                        />

                        {/* قائمة السجلات والعداد */}
                        <div className="logs-panel" style={{
                            width: '220px',
                            maxHeight: '400px',
                            overflowY: 'auto',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            padding: '10px',
                            backgroundColor: '#f9f9f9',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}>
                            {/* منطقة العنوان والعداد */}
                            <div style={{
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                borderBottom: '2px solid #ddd', 
                                paddingBottom: '10px', 
                                marginBottom: '10px'
                            }}>
                                <h3 style={{ margin: 0, fontSize: '15px', color: '#333' }}>Solved Pieces</h3>
                                <div style={{ 
                                    backgroundColor: '#333', color: '#fff', 
                                    padding: '2px 8px', borderRadius: '4px', 
                                    fontSize: '14px', fontWeight: 'bold' 
                                }}>
                                    {formatTime(timer)}
                                </div>
                            </div>

                            {/* القائمة */}
                            {solvedLogs.length === 0 ? (
                                <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
                                    Waiting for solution...
                                </p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {solvedLogs.map((log, idx) => (
                                        <li key={idx} style={{ 
                                            marginBottom: '8px', 
                                            fontSize: '14px', 
                                            display: 'flex', 
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderBottom: '1px solid #eee',
                                            paddingBottom: '4px'
                                        }}>
                                            <span style={{display: 'flex', alignItems: 'center'}}>
                                                <span style={{
                                                    display: 'inline-block', width: '10px', height: '10px', 
                                                    backgroundColor: getColor(log.color), 
                                                    borderRadius: '50%', marginRight: '6px'
                                                }}></span>
                                                Piece #{log.id}
                                            </span>
                                            <span style={{ fontWeight: 'bold', color: '#555', fontSize: '13px' }}>{log.time}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {win}
                </>
            )}
        </div>
    );
};

const getColor = (colorIndex) => {
    const colors = ['#e6e1e1ff','#ff6b6b', '#48dbfb', '#1dd1a1', '#feca57', '#ff9f43', '#5f27cd', '#54a0ff'];
    return colors[colorIndex] || '#000';
};



const btnStyle = (color) => ({
    backgroundColor: color, 
    color: 'white', 
    padding: '8px 15px', 
    border: 'none', 
    borderRadius: '5px', 
    cursor: 'pointer'
});

export default Game;














