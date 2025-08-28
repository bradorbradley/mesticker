"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, User, RotateCcw } from "lucide-react"

interface TicTacToeGameProps {
  playerImage: string
  opponentImage: string
  opponentName: string
  onGameEnd?: () => void
  autoEnd?: boolean
}

type Player = 'ai' | 'human' | null
type Board = Player[]

export default function TicTacToeGame({ 
  playerImage, 
  opponentImage, 
  opponentName, 
  onGameEnd,
  autoEnd = false 
}: TicTacToeGameProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null))
  const [currentPlayer, setCurrentPlayer] = useState<Player>('ai')
  const [winner, setWinner] = useState<Player | 'tie' | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [moveCount, setMoveCount] = useState(0)

  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ]

  const checkWinner = useCallback((board: Board): Player | 'tie' | null => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]
      }
    }
    
    if (board.every(cell => cell !== null)) {
      return 'tie'
    }
    
    return null
  }, [winningCombinations])

  const makeAIMove = useCallback(() => {
    setBoard(prevBoard => {
      const newBoard = [...prevBoard]
      const availableSpots = newBoard.map((spot, index) => spot === null ? index : null).filter(spot => spot !== null) as number[]
      
      if (availableSpots.length === 0) return prevBoard
      
      let move: number
      
      // Simple AI strategy: try to win first, then block, then random
      const aiWinMove = findWinningMove(newBoard, 'ai')
      const blockMove = findWinningMove(newBoard, 'human')
      
      if (aiWinMove !== -1) {
        move = aiWinMove
      } else if (blockMove !== -1) {
        move = blockMove
      } else {
        // Take center if available, otherwise random corner/edge
        if (newBoard[4] === null) {
          move = 4
        } else {
          const corners = [0, 2, 6, 8].filter(i => newBoard[i] === null)
          if (corners.length > 0) {
            move = corners[Math.floor(Math.random() * corners.length)]
          } else {
            move = availableSpots[Math.floor(Math.random() * availableSpots.length)]
          }
        }
      }
      
      newBoard[move] = 'ai'
      return newBoard
    })
    
    setCurrentPlayer('human')
    setMoveCount(prev => prev + 1)
  }, [])

  const findWinningMove = (board: Board, player: Player): number => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination
      const line = [board[a], board[b], board[c]]
      const emptyIndex = line.indexOf(null)
      
      if (emptyIndex !== -1 && line.filter(cell => cell === player).length === 2) {
        return combination[emptyIndex]
      }
    }
    return -1
  }

  const handleCellClick = (index: number) => {
    if (board[index] !== null || winner !== null || currentPlayer !== 'human' || autoEnd) return
    
    setBoard(prevBoard => {
      const newBoard = [...prevBoard]
      newBoard[index] = 'human'
      return newBoard
    })
    
    setCurrentPlayer('ai')
    setMoveCount(prev => prev + 1)
  }

  const resetGame = () => {
    setBoard(Array(9).fill(null))
    setCurrentPlayer('ai')
    setWinner(null)
    setGameStarted(false)
    setMoveCount(0)
  }

  // Start game automatically
  useEffect(() => {
    if (!gameStarted && !autoEnd) {
      const timer = setTimeout(() => {
        setGameStarted(true)
        makeAIMove()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [gameStarted, makeAIMove, autoEnd])

  // AI move logic
  useEffect(() => {
    if (currentPlayer === 'ai' && winner === null && gameStarted && !autoEnd) {
      const timer = setTimeout(() => {
        makeAIMove()
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [currentPlayer, winner, gameStarted, makeAIMove, autoEnd])

  // Check for winner
  useEffect(() => {
    const result = checkWinner(board)
    if (result !== null) {
      setWinner(result)
      if (onGameEnd) {
        setTimeout(onGameEnd, 2000)
      }
    }
  }, [board, checkWinner, onGameEnd])

  // Handle auto-end
  useEffect(() => {
    if (autoEnd && onGameEnd) {
      onGameEnd()
    }
  }, [autoEnd, onGameEnd])

  const renderCell = (index: number) => {
    const cellValue = board[index]
    const isWinningCell = winner && winner !== 'tie' ? 
      winningCombinations.find(combo => 
        combo.includes(index) && combo.every(i => board[i] === winner)
      ) : false

    return (
      <button
        key={index}
        onClick={() => handleCellClick(index)}
        className={`aspect-square rounded-xl border-2 transition-all duration-200 ${
          cellValue 
            ? 'bg-white border-gray-300' 
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
        } ${isWinningCell ? 'animate-pulse bg-green-100 border-green-400' : ''}`}
        disabled={cellValue !== null || winner !== null || currentPlayer !== 'human' || autoEnd}
      >
        {cellValue && (
          <div className="w-full h-full rounded-lg overflow-hidden p-1">
            <img
              src={cellValue === 'ai' ? opponentImage : playerImage}
              alt={cellValue === 'ai' ? opponentName : 'You'}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}
      </button>
    )
  }

  const getStatusMessage = () => {
    if (autoEnd) return "Game paused - your cartoon is ready!"
    if (!gameStarted) return `Get ready to play against ${opponentName}!`
    if (winner === 'ai') return `${opponentName} wins! 🎉`
    if (winner === 'human') return "You win! Amazing! 🏆"
    if (winner === 'tie') return "It's a tie! Great game! 🤝"
    if (currentPlayer === 'ai') return `${opponentName} is thinking...`
    return "Your turn! Click any empty square"
  }

  const getStatusColor = () => {
    if (autoEnd) return "bg-gradient-to-r from-purple-400 to-pink-400"
    if (winner === 'human') return "bg-gradient-to-r from-green-400 to-emerald-400"
    if (winner === 'ai') return "bg-gradient-to-r from-blue-400 to-cyan-400"
    if (winner === 'tie') return "bg-gradient-to-r from-yellow-400 to-orange-400"
    if (currentPlayer === 'ai') return "bg-gradient-to-r from-blue-400 to-cyan-400"
    return "bg-gradient-to-r from-green-400 to-emerald-400"
  }

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-800">Tic-Tac-Toe Challenge!</h3>
          <Badge className={`${getStatusColor()} text-white font-medium px-4 py-2 rounded-full border-0`}>
            {getStatusMessage()}
          </Badge>
        </div>

        {/* Players */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-400">
              <img src={opponentImage} alt={opponentName} className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-blue-600">{opponentName}</p>
              <p className="text-xs text-gray-500">Goes first</p>
            </div>
          </div>
          
          <div className="text-lg font-bold text-gray-400">VS</div>
          
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium text-green-600">You</p>
              <p className="text-xs text-gray-500">Goes second</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-green-400">
              <img src={playerImage} alt="You" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Game Board */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-gray-100 rounded-xl">
          {Array(9).fill(null).map((_, index) => renderCell(index))}
        </div>

        {/* Game Info */}
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Moves: {moveCount}</span>
          {!autoEnd && (
            <Button
              onClick={resetGame}
              variant="outline"
              size="sm"
              className="h-8 px-3"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Instructions */}
        {!gameStarted && !autoEnd && (
          <div className="text-center">
            <p className="text-xs text-gray-500 leading-relaxed">
              Play while your cartoon generates! {opponentName} goes first, then it&apos;s your turn. 
              Try to get 3 in a row! 🎯
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}