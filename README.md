# Multiplayer Checkers Game

A full-stack checkers game application designed for multiplayer gameplay, built with a React frontend and .NET C# backend. The game supports two players, with synchronized, real-time moves enabled by Socket.io, offering an interactive gaming experience in one browser.

## Features

- **Dynamic Game Board**: A checkers board is dynamically generated following game rules.
- **Player Movement**: Allows diagonal forward moves, following official checkers rules.
- **Capture Mechanics**: Players can jump and capture opponent pieces according to standard rules.
- **Multiplayer Support**: Two players can connect through separate tabs within the same browser, with real-time synchronization provided by Socket.io.

## Technologies Used

- **Frontend**: React
- **Backend**: .NET C# with WebSocket integration
- **Sockets**: Socket.io for real-time communication between tabs

## Getting Started

### Prerequisites

- Node.js and npm for the React client

### Installation

1. **Clone the Repository**:
   ```bash
   https://github.com/guyreuveni33/Checkers.git
   ```
2. **Setup the Client**:
   - Navigate to the `client` folder.
   - Install dependencies:
     ```bash
     npm install
     ```
   - Start the client:
     ```bash
     npm start
     ```

3. **Setup the Server**:
   - Navigate to the server project directory.
   - Install required packages and start the server:
     ```bash
     dotnet run
     ```

### Running the Game

1. **Initiating Gameplay**: Open the game in a browser tab; this session will automatically assign the role of Player One.
2. **Joining as Player Two**: Open a new tab in the same browser to join as the second player. The game will automatically assign this session as Player Two.
3. **Real-Time Synchronization**: Moves are synchronized in real-time across both tabs, including notifications for actions like capturing pieces and resetting the game.

## Usage

- **Game Reset**: Either player can reset the board to start a new game.
- **Turn-based Control**: Players can only move their pieces during their designated turn.
- **Instant Updates**: All actions, such as moving and capturing pieces, are immediately reflected across both tabs.
