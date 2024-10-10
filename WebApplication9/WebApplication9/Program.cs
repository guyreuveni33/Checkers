using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using System.Net.WebSockets;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();
app.UseWebSockets();

var player1Socket = (WebSocket)null;
var player2Socket = (WebSocket)null;
var currentTurn = 1;

app.Map("/ws", async context =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        var playerNumber = 0;

        if (player1Socket == null)
        {
            player1Socket = webSocket;
            playerNumber = 1;
        }
        else if (player2Socket == null)
        {
            player2Socket = webSocket;
            playerNumber = 2;
        }
        else
        {
            // If a third player tries to join, notify them the room is full and close the connection
            await SendMessage(webSocket, new { type = "roomFull" });
            await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Room is full", CancellationToken.None);
            return;
        }

        if (playerNumber != 0)
        {
            await SendMessage(webSocket, new { type = "playerNumber", number = playerNumber });

            if (player1Socket != null && player2Socket != null)
            {
                await SendToAllPlayers(new { type = "startGame" });
            }
            else
            {
                await SendMessage(webSocket, new { type = "waitingForOpponent" });
            }

            var buffer = new byte[1024];
            while (webSocket.State == WebSocketState.Open)
            {
                try
                {
                    var result = await webSocket.ReceiveAsync(buffer, CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close) break;

                    var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    var json = System.Text.Json.JsonSerializer.Deserialize<dynamic>(message);
                    var messageType = json.GetProperty("type").GetString();

                    if (messageType == "move")
                    {
                        var otherSocket = playerNumber == 1 ? player2Socket : player1Socket;
                        if (otherSocket?.State == WebSocketState.Open)
                        {
                            currentTurn = currentTurn == 1 ? 2 : 1;
                            await SendMessage(otherSocket, new
                            {
                                type = "opponentMove",
                                board = json.GetProperty("board").GetString(),
                                currentPlayer = currentTurn
                            });
                        }
                    }
                    else if (messageType == "resetGame")
                    {
                        currentTurn = 1;
                        await SendToAllPlayers(new { type = "resetGame" });
                    }
                    else if (messageType == "gameEnd")
                    {
                        await SendToAllPlayers(new
                        {
                            type = "gameEnd",
                            winner = json.GetProperty("winner").GetInt32()
                        });
                    }
                }
                catch
                {
                    break;
                }
            }

            if (webSocket == player1Socket) player1Socket = null;
            else if (webSocket == player2Socket) player2Socket = null;

            var remainingSocket = player1Socket ?? player2Socket;
            if (remainingSocket?.State == WebSocketState.Open)
            {
                await SendMessage(remainingSocket, new
                {
                    type = "playerDisconnected",
                    player = playerNumber
                });
                await SendMessage(remainingSocket, new { type = "waitingForOpponent" });
            }
        }
    }
});

async Task SendMessage(WebSocket socket, object message)
{
    if (socket?.State == WebSocketState.Open)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(message);
        var bytes = Encoding.UTF8.GetBytes(json);
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
    }
}

async Task SendToAllPlayers(object message)
{
    if (player1Socket?.State == WebSocketState.Open)
        await SendMessage(player1Socket, message);
    if (player2Socket?.State == WebSocketState.Open)
        await SendMessage(player2Socket, message);
}

await app.RunAsync();
