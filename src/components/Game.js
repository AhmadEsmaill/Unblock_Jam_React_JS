import React, { useState, useEffect, useCallback } from 'react';
import Board from './Board';

const CELL_SIZE = 50;
const GRID_GAP = 3;

const Game = () => {
    const [levelData, setLevelData] = useState(null);
    const [pieces, setPieces] = useState([]);
    const [win, setWin] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [fileName, setFileName] = useState('');

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
                alert("The JSON file is invalid! Please check the file's validity.");
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
    };

    const handlePieceSlide = useCallback((pieceId, deltaX, deltaY) => {
        if (win) return;

        const pieceToMove = pieces.find(p => p.id === pieceId);
        if (!pieceToMove) return;

        const totalCellSize = CELL_SIZE + GRID_GAP;
        let moveRows = Math.round(deltaY / totalCellSize);
        let moveCols = Math.round(deltaX / totalCellSize);

        if (pieceToMove.direction === 'horizontal') moveRows = 0;
        else if (pieceToMove.direction === 'vertical') moveCols = 0;
        else {
            if (Math.abs(deltaX) > Math.abs(deltaY)) moveRows = 0;
            else moveCols = 0;
        }

        if (moveRows === 0 && moveCols === 0) return;

        const startCoords = pieceToMove.coordinates;
        let finalCoords = startCoords;
        const totalSteps = Math.max(Math.abs(moveRows), Math.abs(moveCols));
        const stepDirection = { row: Math.sign(moveRows), col: Math.sign(moveCols) };

        const occupiedCells = new Set();
        pieces.filter(p => p.id !== pieceId).forEach(p => p.coordinates.forEach(c => occupiedCells.add(`${c.row},${c.col}`)));
        levelData.blocks.forEach(b => occupiedCells.add(`${b[0]},${b[1]}`));
        levelData.exists.forEach(g => g.coordinates.forEach(c => occupiedCells.add(`${c[0]},${c[1]}`)));

        for (let i = 1; i <= totalSteps; i++) {
            const nextStepCoords = finalCoords.map(c => ({
                row: c.row + stepDirection.row,
                col: c.col + stepDirection.col,
            }));

            const isBlocked = nextStepCoords.some(c => occupiedCells.has(`${c.row},${c.col}`));
            const isOutside = nextStepCoords.some(c => c.row < 0 || c.row >= levelData.rows || c.col < 0 || c.col >= levelData.cols);

            if (isBlocked || isOutside) break;
            finalCoords = nextStepCoords;
        }

        const newPiecesState = pieces.map(p =>
            p.id === pieceId ? { ...p, coordinates: finalCoords } : p
        );
        const movedPieceFinalState = newPiecesState.find(p => p.id === pieceId);

        let pieceRemoved = false;
        const dirRow = stepDirection.row;
        const dirCol = stepDirection.col;

        if (dirRow !== 0 || dirCol !== 0) {
            const rowsSet = new Set(), colsSet = new Set();
            finalCoords.forEach(c => { rowsSet.add(c.row); colsSet.add(c.col); });

            let touchingRow = null, touchingCol = null;
            if (dirRow === -1) touchingRow = Math.min(...finalCoords.map(c => c.row)) - 1;
            if (dirRow === 1) touchingRow = Math.max(...finalCoords.map(c => c.row)) + 1;
            if (dirCol === -1) touchingCol = Math.min(...finalCoords.map(c => c.col)) - 1;
            if (dirCol === 1) touchingCol = Math.max(...finalCoords.map(c => c.col)) + 1;

            for (const gate of levelData.exists) {
                if (movedPieceFinalState.colors !== gate.color) continue;

                const gateRows = new Set(), gateCols = new Set();
                gate.coordinates.forEach(c => { gateRows.add(c[0]); gateCols.add(c[1]); });

                let matches = false;

                if (dirRow !== 0 && gateRows.size === 1 && [...gateRows][0] === touchingRow) {
                    const gateMinCol = Math.min(...gate.coordinates.map(c => c[1]));
                    const gateMaxCol = Math.max(...gate.coordinates.map(c => c[1]));
                    const pieceMinCol = Math.min(...finalCoords.map(c => c.col));
                    const pieceMaxCol = Math.max(...finalCoords.map(c => c.col));
                    if (pieceMinCol >= gateMinCol && pieceMaxCol <= gateMaxCol) matches = true;
                }

                if (dirCol !== 0 && gateCols.size === 1 && [...gateCols][0] === touchingCol) {
                    const gateMinRow = Math.min(...gate.coordinates.map(c => c[0]));
                    const gateMaxRow = Math.max(...gate.coordinates.map(c => c[0]));
                    const pieceMinRow = Math.min(...finalCoords.map(c => c.row));
                    const pieceMaxRow = Math.max(...finalCoords.map(c => c.row));
                    if (pieceMinRow >= gateMinRow && pieceMaxRow <= gateMaxRow) matches = true;
                }

                if (matches) {
                    pieceRemoved = true;
                    break;
                }
            }
        }

        if (pieceRemoved) {
            const remaining = pieces.filter(p => p.id !== pieceId);
            setPieces(remaining);
            if (remaining.length === 0) setWin(true);
        } else {
            setPieces(newPiecesState);
        }
    }, [pieces, levelData, win]);

    return (
        <div className="game-master">

            {showIntro && (
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

            )}

            {!showIntro && levelData && (
                <>
                    <div className="game-header">
                        <h1>Unblock Jam</h1>
                        {fileName && <p className="level-name">level file : {fileName}</p>}
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
                                <div className="win-stars">⭐ ⭐ ⭐</div>
                                <h2>Congratulations! You Win 🎉</h2>
                                <p>All pieces have been successfully removed!</p>

                                <div className="win-actions">
                                    <button className="btn-restart" onClick={restartGame}>
                                        ↺ Restart Game
                                    </button>
                                    <button className="btn-new" onClick={newGame}>
                                        New Game
                                    </button>
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