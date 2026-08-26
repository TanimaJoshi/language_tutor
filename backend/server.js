const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

wss.on('connection', (clientWs) => {
    console.log('Client connected to backend WS');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set');
        clientWs.close(1011, 'GEMINI_API_KEY is not set on the server');
        return;
    }

    const geminiUrl = `${GEMINI_WS_URL}?key=${apiKey}`;
    const geminiWs = new WebSocket(geminiUrl);

    const messageQueue = [];

    geminiWs.on('open', () => {
        console.log('Connected to Gemini Live API');
        // Flush queue
        while (messageQueue.length > 0) {
            geminiWs.send(messageQueue.shift());
        }
    });

    geminiWs.on('message', (data) => {
        // Log a snippet of the message to understand what Gemini is sending
        const msgSnippet = data.toString().substring(0, 200);
        console.log('Gemini sent:', msgSnippet);
        
        // Forward Gemini messages to the client
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data.toString());
        }
    });

    geminiWs.on('close', (code, reason) => {
        console.log('Gemini WS closed:', code, reason ? reason.toString() : '');
        if (clientWs.readyState === WebSocket.OPEN) {
            if (code === 1005 || !code) {
                clientWs.close();
            } else {
                clientWs.close(code, reason);
            }
        }
    });

    geminiWs.on('error', (error) => {
        console.error('Gemini WS error:', error);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(1011, 'Gemini WS error');
        }
    });

    clientWs.on('message', (data) => {
        // Forward client messages to Gemini
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data);
        } else {
            console.log('Queueing message, Gemini WS not open yet');
            messageQueue.push(data);
        }
    });

    clientWs.on('close', (code, reason) => {
        console.log('Client WS closed:', code, reason ? reason.toString() : '');
        if (geminiWs.readyState === WebSocket.OPEN) {
            if (code === 1005 || !code) {
                geminiWs.close();
            } else {
                geminiWs.close(code, reason);
            }
        }
    });

    clientWs.on('error', (error) => {
        console.error('Client WS error:', error);
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close(1011, 'Client WS error');
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});
