import React, {useState, useEffect, useCallback, useRef} from 'react';

const BOARD_SIZE = 8;
const PLAYER_1 = 1;
const PLAYER_2 = 2;
const WS_URL = 'ws://localhost:5232/ws';

function hasValidMoves(player, board) {
    const direction = player === PLAYER_1 ? -1 : 1;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row] && board[row][col] === player) {
                // Check basic diagonal moves
                const basicMoves = [[direction, -1], [direction, 1]];
                for (const [rowOffset, colOffset] of basicMoves) {
                    const newRow = row + rowOffset;
                    const newCol = col + colOffset;
                    if (
                        newRow >= 0 && newRow < BOARD_SIZE &&
                        newCol >= 0 && newCol < BOARD_SIZE &&
                        board[newRow][newCol] === null
                    ) {
                        return true;
                    }
                }

                // Check jump moves
                const jumpMoves = [[2 * direction, -2], [2 * direction, 2]];
                for (const [rowOffset, colOffset] of jumpMoves) {
                    const newRow = row + rowOffset;
                    const newCol = col + colOffset;
                    const jumpedRow = row + rowOffset / 2;
                    const jumpedCol = col + colOffset / 2;

                    if (
                        newRow >= 0 && newRow < BOARD_SIZE &&
                        newCol >= 0 && newCol < BOARD_SIZE &&
                        board[newRow][newCol] === null &&
                        board[jumpedRow][jumpedCol] === (player === PLAYER_1 ? PLAYER_2 : PLAYER_1)
                    ) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function CheckersGame() {
    const [board, setBoard] = useState([]);
    const [selectedPiece, setSelectedPiece] = useState(null);
    const [currentPlayer, setCurrentPlayer] = useState(PLAYER_1);
    const [playerNumber, setPlayerNumber] = useState(null);
    const [gameStatus, setGameStatus] = useState('Connecting to server...');
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const [roomFull, setRoomFull] = useState(false); // Flag to prevent reconnection if room is full


    const initializeBoard = useCallback(() => {
        const newBoard = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if ((row + col) % 2 !== 0) {
                    newBoard[row][col] = PLAYER_2;
                }
            }
        }
        for (let row = BOARD_SIZE - 3; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if ((row + col) % 2 !== 0) {
                    newBoard[row][col] = PLAYER_1;
                }
            }
        }
        setBoard(newBoard);
        setCurrentPlayer(PLAYER_1);
        setSelectedPiece(null);
    }, []);

    const checkForWinner = (boardState) => {
        let player1Pieces = 0;
        let player2Pieces = 0;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (boardState[row] && boardState[row][col] === PLAYER_1) {
                    player1Pieces++;
                } else if (boardState[row] && boardState[row][col] === PLAYER_2) {
                    player2Pieces++;
                }
            }
        }

        const opponent = currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
        if (player1Pieces === 0) {
            socketRef.current.send(JSON.stringify({type: 'gameEnd', winner: PLAYER_2}));
        } else if (player2Pieces === 0) {
            socketRef.current.send(JSON.stringify({type: 'gameEnd', winner: PLAYER_1}));
        } else if (!hasValidMoves(opponent, boardState)) {
            socketRef.current.send(JSON.stringify({type: 'gameEnd', winner: currentPlayer}));
        }
    };


    const connectWebSocket = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;
        const ws = new WebSocket(WS_URL);
        socketRef.current = ws;
        ws.onopen = () => setGameStatus('Connected, waiting for game to start...');
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'playerNumber':
                    setPlayerNumber(message.number);
                    setGameStatus(`You are Player ${message.number}. Waiting for the game to start.`);
                    break;
                case 'waitingForOpponent':
                    setGameStatus('Waiting for opponent to join...');
                    initializeBoard();
                    break;
                case 'startGame':
                    setGameStatus('Get ready, we are about to start');
                    setTimeout(() => {
                        setGameStatus('Game in progress');
                        initializeBoard();
                        setCurrentPlayer(PLAYER_1);
                    }, 3000);
                    break;
                case 'resetGame':
                    initializeBoard();
                    setGameStatus('Game reset. Starting new game...');
                    setCurrentPlayer(PLAYER_1);
                    setTimeout(() => {
                        setGameStatus('Game in progress');
                    }, 3000);
                    break;
                case 'opponentMove':
                    setBoard(JSON.parse(message.board));
                    setCurrentPlayer(parseInt(message.currentPlayer));
                    checkForWinner(JSON.parse(message.board));
                    break;
                 
                case 'playerDisconnected':
                    setGameStatus(`Player ${message.player} disconnected. Waiting for new opponent...`);
                    break;

                case 'roomFull':
                    setGameStatus('Room is full. Please try again later.');
                    setRoomFull(true);
                    ws.close();
                    break;
                case 'gameEnd':
                    setGameStatus({winner: message.winner});
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        };
        ws.onclose = () => {
            if (!roomFull) {
                setGameStatus('Disconnected from server. Attempting to reconnect...');
                reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
            }
        };
        ws.onerror = () => setGameStatus('Connection error. Attempting to reconnect...');
    };
    useEffect(() => {
        initializeBoard();
        connectWebSocket();
        return () => {
            if (socketRef.current) socketRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, []);
    const handleClick = (row, col) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        if (playerNumber !== currentPlayer) return;

        const mandatoryJump = hasAvailableJumps(currentPlayer);

        if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
            setSelectedPiece(null); // Deselect if clicked again
        } else if (board[row][col] === currentPlayer) {
            setSelectedPiece({row, col}); // Select piece if it belongs to the current player
        } else if (
            selectedPiece &&
            isValidMove(selectedPiece.row, selectedPiece.col, row, col, mandatoryJump)
        ) {
            // If there's a mandatory jump, allow only jump moves
            const newBoard = JSON.parse(JSON.stringify(board));
            movePieceOnBoard(newBoard, selectedPiece.row, selectedPiece.col, row, col);
            socketRef.current.send(JSON.stringify({type: 'move', board: JSON.stringify(newBoard)}));
            setBoard(newBoard);
            setSelectedPiece(null);
            setCurrentPlayer(currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1);
            checkForWinner(newBoard);
        }
    };
    const hasAvailableJumps = (player) => {
        const direction = player === PLAYER_1 ? -1 : 1; // PLAYER_1 moves up, PLAYER_2 moves down

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row] && board[row][col] === player) {
                    // Check for jump moves (2 spaces) in both diagonal directions
                    const jumpMoves = [[2 * direction, -2], [2 * direction, 2]];
                    for (const [rowOffset, colOffset] of jumpMoves) {
                        const newRow = row + rowOffset;
                        const newCol = col + colOffset;
                        const jumpedRow = row + rowOffset / 2;
                        const jumpedCol = col + colOffset / 2;

                        // Ensure the destination is within the board, is empty, and the piece being jumped over is the opponent's
                        if (
                            newRow >= 0 && newRow < BOARD_SIZE &&
                            newCol >= 0 && newCol < BOARD_SIZE &&
                            board[newRow][newCol] === null &&
                            board[jumpedRow][jumpedCol] === (player === PLAYER_1 ? PLAYER_2 : PLAYER_1)
                        ) {
                            return true; // A jump is available
                        }
                    }
                }
            }
        }
        return false; // No jumps available
    };
    const movePieceOnBoard = (boardState, fromRow, fromCol, toRow, toCol) => {
        boardState[toRow][toCol] = boardState[fromRow][fromCol];
        boardState[fromRow][fromCol] = null;
        if (Math.abs(toRow - fromRow) === 2) {
            const jumpedRow = (fromRow + toRow) / 2;
            const jumpedCol = (fromCol + toCol) / 2;
            boardState[jumpedRow][jumpedCol] = null;
        }
    };

    const isValidMove = (fromRow, fromCol, toRow, toCol, mandatoryJump = false) => {
        // Check if destination is within board bounds
        if (toRow < 0 || toRow >= BOARD_SIZE || toCol < 0 || toCol >= BOARD_SIZE) return false;

        // Check if destination cell is empty
        if (board[toRow][toCol] !== null) return false;

        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);

        const direction = currentPlayer === PLAYER_1 ? -1 : 1;

        if (rowDiff === 2 * direction && colDiff === 2) {
            const jumpedRow = fromRow + direction;
            const jumpedCol = fromCol + (toCol - fromCol) / 2;

            // Check if there's an opponent piece in between
            if (board[jumpedRow][jumpedCol] === (currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1)) {
                return true; // Valid jump move
            }
        }

        // Basic diagonal move only allowed if there's no mandatory jump
        if (!mandatoryJump && rowDiff === direction && colDiff === 1) {
            return true;
        }

        return false; // All other moves are invalid
    };


    const resetGame = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({type: 'resetGame'}));
            initializeBoard();
            setCurrentPlayer(PLAYER_1);
            setSelectedPiece(null);
            setGameStatus('Game reset. Starting new game...');
            setTimeout(() => {
                setGameStatus('Game in progress');
            }, 3000);
        }
    };

    return (
        <div className="game-container">
            <div className="checkers-game">
                {playerNumber && (
                    <div
                        className={`player-indicator ${playerNumber === PLAYER_1 ? 'player1-indicator' : 'player2-indicator'}`}>
                        <span
                            className={`player-circle ${playerNumber === PLAYER_1 ? 'player1-circle' : 'player2-circle'}`}></span>
                        <span className="player-marker-text">Player</span>
                    </div>
                )}
                <h1 className="game-title">Checkers Game</h1>
                <div className="game-status">
                    {roomFull ? (
                        <span className="room-full-message">Room is full. Please try again later.</span>
                    ) : gameStatus.winner ? (
                        <div className="winner-message">
                            <span>Player </span>
                            <span
                                className={`player-circle ${gameStatus.winner === PLAYER_1 ? 'player1-circle' : 'player2-circle'}`}/>
                            <span> wins!</span>
                        </div>
                    ) : (
                        <span>{gameStatus}</span>
                    )}
                </div>
                <div className="board">
                    {board.map((row, rowIndex) => (
                        <div key={rowIndex} className="row">
                            {row.map((cell, colIndex) => (
                                <div
                                    key={colIndex}
                                    className={`cell ${(rowIndex + colIndex) % 2 === 0 ? 'light' : 'dark'} ${
                                        selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex ? 'selected' : ''
                                    }`}
                                    onClick={() => handleClick(rowIndex, colIndex)}
                                >
                                    {cell && (
                                        <div
                                            className={`piece ${cell === PLAYER_1 ? 'player1' : 'player2'} ${
                                                selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex ? 'selected' : ''
                                            }`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="info">
                    {!roomFull && (
                        <div className="current-player">
                            <span
                                className={`player-circle ${currentPlayer === PLAYER_1 ? 'player1-circle' : 'player2-circle'}`}></span>
                            <span className="current-player-text">Current Player</span>
                        </div>
                    )}
                </div>
                {!roomFull && (
                    <button className="reset-button" onClick={resetGame}>
                        Reset Game
                    </button>
                )}

            </div>
        </div>
    );
}

export default CheckersGame;