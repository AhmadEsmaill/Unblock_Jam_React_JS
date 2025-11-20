import React, { useState, useRef } from 'react';

const Board = ({ rows, cols, pieces, blocks, gates, onPieceSlide }) => {
    const [dragInfo, setDragInfo] = useState(null);
    const boardRef = useRef(null);

    const handleMouseDown = (e, piece) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        const rect = boardRef.current.getBoundingClientRect();
        const cellSize = rect.width / cols; 

        setDragInfo({
            piece,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - rect.left - (piece.coordinates[0].col + 1) * cellSize + cellSize / 2,
            offsetY: e.clientY - rect.top - (piece.coordinates[0].row + 1) * cellSize + cellSize / 2,
            cellSize,
        });
    };

    const handleMouseMove = (e) => {
        if (!dragInfo) return;

        const deltaX = e.clientX - dragInfo.startX;
        const deltaY = e.clientY - dragInfo.startY;

        const translateX = deltaX;
        const translateY = deltaY;

        dragInfo.piece.coordinates.forEach((_, i) => {
            const el = document.getElementById(`piece-cell-${dragInfo.piece.id}-${i}`);
            if (el) {
                el.style.transform = `translate(${translateX}px, ${translateY}px)`;
                el.style.transition = 'none'; 
                el.style.zIndex = '100';
            }
        });
    };

    const handleMouseUp = (e) => {
        if (!dragInfo) return;

        const deltaX = e.clientX - dragInfo.startX;
        const deltaY = e.clientY - dragInfo.startY;

        dragInfo.piece.coordinates.forEach((_, i) => {
            const el = document.getElementById(`piece-cell-${dragInfo.piece.id}-${i}`);
            if (el) {
                el.style.transform = 'translate(0, 0)';
                el.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.4, 1)';
                el.style.zIndex = '10';
            }
        });

        setTimeout(() => {
            onPieceSlide(dragInfo.piece.id, deltaX, deltaY);
        }, 300);

        setDragInfo(null);
    };

    React.useEffect(() => {
        if (dragInfo) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragInfo]);

    const renderGridItems = () => {
        const items = [];

        blocks.forEach((block, i) => items.push(
            <div key={`block-${i}`} className="grid-item block" style={{ gridRow: block.row + 1, gridColumn: block.col + 1 }} />
        ));
        gates.forEach((gate, i) => gate.coordinates.forEach((coord, j) => items.push(
            <div key={`gate-${i}-${j}`} className={`grid-item gate color-${gate.color}`} style={{ gridRow: coord[0] + 1, gridColumn: coord[1] + 1 }} />
        )));

        pieces.forEach(piece => {
            const isDragging = dragInfo && dragInfo.piece.id === piece.id;

            piece.coordinates.forEach((coord, i) => {
                items.push(
                    <div
                        key={`piece-${piece.id}-${i}`}
                        id={`piece-cell-${piece.id}-${i}`}
                        className={`grid-item piece color-${piece.colors} ${isDragging ? 'dragging' : ''}`}
                        style={{ 
                            gridRow: coord.row + 1, 
                            gridColumn: coord.col + 1,
                            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.4, 1)'
                        }}
                        onMouseDown={(e) => handleMouseDown(e, piece)}
                    >
                        {piece.direction && (
                            <div className={`direction-arrow arrow-${piece.direction}`}>
                                {piece.direction === 'horizontal' ? '↔' : '↕'}
                            </div>
                        )}
                    </div>
                );
            });
        });

        return items;
    };

    return (
        <div className="board-wrapper">
            <div
                ref={boardRef}
                className="board"
                style={{
                    gridTemplateRows: `repeat(${rows}, var(--cell-size))`,
                    gridTemplateColumns: `repeat(${cols}, var(--cell-size))`,
                    padding: `var(--cell-size)`,
                    margin: `calc(-1 * var(--cell-size))`,
                }}
                onMouseLeave={handleMouseUp}
            >
                {renderGridItems()}
            </div>
        </div>
    );
};

export default Board;