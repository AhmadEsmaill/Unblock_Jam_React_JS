import React, { useState, useCallback } from 'react';
import Board from './Board';

const CELL_SIZE = 50;
const GRID_GAP = 3;

const Game = () => {
    // ==========================================
    // =========== State Definitions ============
    // ==========================================
    const [levelData, setLevelData] = useState(null);
    const [pieces, setPieces] = useState([]);
    const [win, setWin] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [fileName, setFileName] = useState('');
    const [isSolving, setIsSolving] = useState(false);

    // ==========================================
    // =========== File & Level Management ======
    // ==========================================
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
    };

    const restartGame = () => {
        if (levelData) loadLevel(levelData);
    };

    const newGame = () => {
        setShowIntro(true);
        setLevelData(null);
        setPieces([]);
        setWin(false);
        setFileName('');
        setIsSolving(false);
    };

    // ==========================================
    // =========== Helper Functions =============
    // ==========================================
    
    // تحويل الحالة إلى نص (للتخزين في Set)
    const serializeState = (piecesList) => {
        // الترتيب مهم لضمان أن نفس الحالة تنتج نفس النص دائماً
        const sorted = [...piecesList].sort((a, b) => a.id - b.id);
        return JSON.stringify(sorted.map(p => ({ i: p.id, c: p.coordinates })));
    };

    // التحقق هل القطعة في موضع خروج (تطابق بوابة)
    const checkExit = (piece, currentCoords, lvlData) => {
        for (const gate of lvlData.exists) {
            if (piece.colors !== gate.color) continue;

            // هل أي جزء من القطعة يلامس أو يتداخل مع البوابة؟
            // في المنطق البسيط للخوارزمية: إذا دخلت الإحداثيات نطاق البوابة فهي خروج
            for (const c of currentCoords) {
                const isInGate = gate.coordinates.some(g => g[0] === c.row && g[1] === c.col);
                if (isInGate) return true;
            }
        }
        return false;
    };

    // ==========================================
    // =========== AI Solver Logic ==============
    // ==========================================

    const getSuccessors = (currentPieces, lvlData) => {
        const successors = [];
        
        // 1. تحديد العوائق الثابتة
        const staticBlocks = new Set();
        lvlData.blocks.forEach(b => staticBlocks.add(`${b[0]},${b[1]}`));

        // 2. تكرار لكل قطعة
        for (let i = 0; i < currentPieces.length; i++) {
            const activePiece = currentPieces[i];
            
            // 3. بناء خريطة المشغول (باستثناء القطعة الحالية)
            const occupied = new Set(staticBlocks);
            for (let j = 0; j < currentPieces.length; j++) {
                if (i !== j) {
                    currentPieces[j].coordinates.forEach(c => occupied.add(`${c.row},${c.col}`));
                }
            }

            // 4. تحديد الاتجاهات
            const directions = [];
            if (activePiece.direction === 'horizontal') directions.push({ r: 0, c: 1 }, { r: 0, c: -1 });
            else if (activePiece.direction === 'vertical') directions.push({ r: 1, c: 0 }, { r: -1, c: 0 });
            else { 
                directions.push({ r: 0, c: 1 }, { r: 0, c: -1 }, { r: 1, c: 0 }, { r: -1, c: 0 });
            }

            // 5. الانزلاق (Sliding Logic)
            for (const dir of directions) {
                let currentCoords = activePiece.coordinates;
                let steps = 0;

                // استمر في التحرك في هذا الاتجاه حتى تصطدم
                while (true) {
                    steps++;
                    // حساب الإحداثيات التالية
                    const nextCoords = currentCoords.map(c => ({
                        row: c.row + dir.r,
                        col: c.col + dir.c
                    }));

                    // هل اصطدمنا أو خرجنا من الحدود؟
                    let blocked = false;
                    for (const c of nextCoords) {
                        if (c.row < 0 || c.row >= lvlData.rows || c.col < 0 || c.col >= lvlData.cols) {
                            blocked = true; break;
                        }
                        if (occupied.has(`${c.row},${c.col}`)) {
                            blocked = true; break;
                        }
                    }

                    if (blocked) break; // توقف عن الانزلاق في هذا الاتجاه

                    // الحركة صالحة، الآن تحقق: هل هي خروج؟
                    if (checkExit(activePiece, nextCoords, lvlData)) {
                        // حالة فوز جزئي (خروج قطعة)
                        const newPieces = currentPieces.filter(p => p.id !== activePiece.id);
                        successors.push({ pieces: newPieces });
                        break; // بمجرد الخروج، تنتهي حركة هذه القطعة
                    } else {
                        // حالة حركة عادية
                        const newPieces = currentPieces.map(p => 
                            p.id === activePiece.id ? { ...p, coordinates: nextCoords } : p
                        );
                        successors.push({ pieces: newPieces });
                        
                        // تحديث الإحداثيات الحالية لتجربة الخطوة التالية (الانزلاق المستمر)
                        currentCoords = nextCoords;
                    }
                }
            }
        }
        return successors;
    };

    // --- BFS Implementation ---
    const solveBFS = async () => {
        if (!levelData || pieces.length === 0) return;
        setIsSolving(true);
        // نعطي المتصفح وقتاً لرسم حالة "Solving"
        await new Promise(r => setTimeout(r, 100));

        const queue = [{ pieces: pieces, path: [] }];
        const visited = new Set([serializeState(pieces)]);
        let iterations = 0;
        const MAX_ITERATIONS = 30000; // رقم كبير لأن البحث أصبح أسرع

        while (queue.length > 0) {
            iterations++;
            if (iterations > MAX_ITERATIONS) {
                alert("BFS: Search limit reached!");
                setIsSolving(false);
                return;
            }

            const current = queue.shift();

            // شرط الفوز
            if (current.pieces.length === 0) {
                animateSolution(current.path);
                return;
            }

            const successors = getSuccessors(current.pieces, levelData);
            for (const succ of successors) {
                const stateStr = serializeState(succ.pieces);
                if (!visited.has(stateStr)) {
                    visited.add(stateStr);
                    queue.push({ 
                        pieces: succ.pieces, 
                        path: [...current.path, succ.pieces] 
                    });
                }
            }
        }
        alert("No solution found!");
        setIsSolving(false);
    };

    // --- DFS Implementation ---
    const solveDFS = async () => {
        if (!levelData || pieces.length === 0) return;
        setIsSolving(true);
        await new Promise(r => setTimeout(r, 100));

        const stack = [{ pieces: pieces, path: [] }];
        const visited = new Set([serializeState(pieces)]);
        let iterations = 0;
        const MAX_ITERATIONS = 200000;

        while (stack.length > 0) {
            iterations++;
            if (iterations > MAX_ITERATIONS) {
                alert("DFS: Search limit reached!");
                setIsSolving(false);
                return;
            }

            const current = stack.pop();

            if (current.pieces.length === 0) {
                animateSolution(current.path);
                return;
            }

            const successors = getSuccessors(current.pieces, levelData);
            for (const succ of successors) {
                const stateStr = serializeState(succ.pieces);
                if (!visited.has(stateStr)) {
                    visited.add(stateStr);
                    stack.push({ 
                        pieces: succ.pieces, 
                        path: [...current.path, succ.pieces] 
                    });
                }
            }
        }
        alert("No solution found!");
        setIsSolving(false);
    };

    const animateSolution = (path) => {
        let index = 0;
        // نجعل الحركة سريعة قليلاً (200ms)
        const interval = setInterval(() => {
            if (index >= path.length) {
                clearInterval(interval);
                setWin(true);
                setIsSolving(false);
                return;
            }
            setPieces(path[index]);
            index++;
        }, 200);
    };

    // ==========================================
    // =========== Manual Interaction Logic =====
    // ==========================================
    const handlePieceSlide = useCallback((pieceId, deltaX, deltaY) => {
        if (win || isSolving) return;

        const pieceToMove = pieces.find(p => p.id === pieceId);
        if (!pieceToMove) return;

        const totalCellSize = CELL_SIZE + GRID_GAP;
        let moveRows = Math.round(deltaY / totalCellSize);
        let moveCols = Math.round(deltaX / totalCellSize);

        // تقييد الحركة حسب اتجاه القطعة
        if (pieceToMove.direction === 'horizontal') moveRows = 0;
        else if (pieceToMove.direction === 'vertical') moveCols = 0;
        else {
            if (Math.abs(deltaX) > Math.abs(deltaY)) moveRows = 0;
            else moveCols = 0;
        }

        if (moveRows === 0 && moveCols === 0) return;

        // حساب عدد الخطوات والاتجاه
        const totalSteps = Math.max(Math.abs(moveRows), Math.abs(moveCols));
        const stepDir = { row: Math.sign(moveRows), col: Math.sign(moveCols) };

        // بناء العوائق للتحقق
        const occupied = new Set();
        pieces.filter(p => p.id !== pieceId).forEach(p => p.coordinates.forEach(c => occupied.add(`${c.row},${c.col}`)));
        levelData.blocks.forEach(b => occupied.add(`${b[0]},${b[1]}`));
        
        // ملاحظة: البوابات ليست عوائق صلبة في اللعب اليدوي إلا إذا كانت بلون مختلف
        // للتبسيط، نتحقق من الاصطدام بالبوابات لاحقاً في منطق الخروج
        
        let finalCoords = pieceToMove.coordinates;
        
        // محاكاة الخطوات خطوة بخطوة
        for (let i = 1; i <= totalSteps; i++) {
            const nextCoords = finalCoords.map(c => ({
                row: c.row + stepDir.row,
                col: c.col + stepDir.col
            }));

            // هل اصطدمنا بعائق صلب (قطعة أخرى أو جدار)؟
            const isBlocked = nextCoords.some(c => occupied.has(`${c.row},${c.col}`));
            // هل خرجنا من حدود اللوحة؟
            const isOutside = nextCoords.some(c => c.row < 0 || c.row >= levelData.rows || c.col < 0 || c.col >= levelData.cols);

            if (isBlocked || isOutside) break;
            finalCoords = nextCoords;
        }

        // التحقق من الفوز (الخروج)
        if (checkExit(pieceToMove, finalCoords, levelData)) {
            const remaining = pieces.filter(p => p.id !== pieceId);
            setPieces(remaining);
            if (remaining.length === 0) setWin(true);
        } else {
            // تحديث المكان فقط
            setPieces(pieces.map(p => p.id === pieceId ? { ...p, coordinates: finalCoords } : p));
        }

    }, [pieces, levelData, win, isSolving]);

    // ==========================================
    // =========== UI Render ====================
    // ==========================================
    return (
        <div className="game-master">
            {showIntro && (
                <div className="intro-overlay">
                    <div className="intro-card">
                        <h1 className="game-title">Unblock Jam</h1>
                        <p className="game-info">
                            Choose a level file to start.
                        </p>
                        <label className="file-upload-label">
                            <input type="file" accept=".json" onChange={handleFileUpload} />
                            <span className="file-upload-btn">
                                {fileName ? fileName : 'Choose Level (.json)'}
                            </span>
                        </label>
                    </div>
                </div>
            )}

            {!showIntro && levelData && (
                <>
                    <div className="game-header">
                        <h1>Unblock Jam</h1>
                        
                        <div className="solver-controls" style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '10px 0' }}>
                            <button 
                                onClick={solveBFS} 
                                disabled={isSolving || win}
                                style={{
                                    padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: isSolving ? 'not-allowed' : 'pointer', opacity: isSolving ? 0.6 : 1
                                }}
                            >
                                Solve BFS
                            </button>
                            <button 
                                onClick={solveDFS} 
                                disabled={isSolving || win}
                                style={{
                                    padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: isSolving ? 'not-allowed' : 'pointer', opacity: isSolving ? 0.6 : 1
                                }}
                            >
                                Solve DFS
                            </button>
                            <button 
                                onClick={restartGame}
                                disabled={isSolving}
                                style={{
                                    padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                                }}
                            >
                                Reset
                            </button>
                        </div>
                        {isSolving && <div style={{ color: '#ff9800', fontWeight: 'bold' }}>AI is thinking... please wait</div>}
                    </div>

                    <Board
                        rows={levelData.rows}
                        cols={levelData.cols}
                        pieces={pieces}
                        blocks={levelData.blocks.map(b => ({ row: b[0], col: b[1] }))}
                        gates={levelData.exists}
                        onPieceSlide={handlePieceSlide}
                    />

                    {win && (
                        <div className="win-overlay">
                            <div className="win-modal">
                                <h2>🎉 Solved! 🎉</h2>
                                <p>Great job!</p>
                                <div className="win-actions">
                                    <button className="btn-restart" onClick={restartGame}>Replay</button>
                                    <button className="btn-new" onClick={newGame}>New Level</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Game;