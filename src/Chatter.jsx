// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useEffect, useState, useRef } from 'react'
import './App.css';
import { VegaLite } from 'react-vega';

export const Chatter = ({ accessToken, agentConfig }) => {
    const [userInfo, setUserInfo] = useState({});
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const chatContainerRef = useRef(null);

    const API_URL = process.env.REACT_APP_LOOKER_AGENT_API_URL;
    const GCP_PROJECT_NAME = process.env.REACT_APP_GCP_PROJECT_NAME;
    const GCP_PROJECT = `projects/${GCP_PROJECT_NAME}`
    const LOOKER_CLIENT_ID = process.env.REACT_APP_LOOKER_CLIENT_ID;
    const LOOKER_CLIENT_SECRET = process.env.REACT_APP_LOOKER_CLIENT_SECRET;
    const LOOKER_INSTANCE_URL = process.env.REACT_APP_LOOKER_INSTANCE_URL;

    useEffect(() => {
        if (agentConfig) {
            setMessages([])
            console.log(`Agent Configuration:`);
            // console.log(agentConfig);
            console.log(`Type: ${agentConfig.type}`);
            console.log(agentConfig.type === 'looker' ? `Explore: ${agentConfig.explore}` : agentConfig.type === 'bigquery' ? `Dataset: ${agentConfig.bq_dataset_id}` : 'unknown');
        }
    }, [agentConfig]);
    

    useEffect(() => {
        setUserInfo({ avatar_url: 'snowboarder.png' })
    }, []);

    // Updated scroll handling
    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            setTimeout(() => {
                chatContainerRef.current.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100); // Small delay to ensure content is rendered
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const formatMessageText = (text, maxLength = 100) => {
        if (!text) return '';

        const words = text.split(' ');
        let currentLine = '';
        let formattedText = '';

        words.forEach(word => {
            if ((currentLine + word).length > maxLength) {
                formattedText += currentLine.trim() + '\n'; // Add new line
                currentLine = word + ' ';
            } else {
                currentLine += word + ' ';
            }
        });

        formattedText += currentLine.trim(); // Add remaining text
        return formattedText;
    };

    const extractResponseText = async (response) => {
        // console.log('response: ', response);

        const extractedText = [];

        if (!Array.isArray(response)) {
            console.error('Invalid response format:', response);
            return extractedText; // Return an empty array if response.body is not iterable
        }

        for (const item of response) {
            if (item.systemMessage && item.systemMessage.text && Array.isArray(item.systemMessage.text.parts)) {
                extractedText.push(...item.systemMessage.text.parts);
            }
        }

        const formattedMessage = formatMessageText(extractedText.join(' '));

        const botMessage = { sender: 'bot', text: formattedMessage };

        setMessages(prevMessages => {
            const newMessages = [...prevMessages, botMessage];
            console.log('newMessages: ', newMessages)
            return newMessages;
        });
    };

    const extractResponseChart = async (response) => {
        // console.log('response: ', response);

        if (!Array.isArray(response)) {
            console.error('Invalid response format:', response);
            return;
        }

        for (const item of response) {
            if (item.systemMessage && item.systemMessage.chart && item.systemMessage.chart.result && item.systemMessage.chart.result.vegaConfig) {
                const vegaConfig = item.systemMessage.chart.result.vegaConfig;
                // console.log(vegaConfig);

                const chartMessage = { sender: 'bot', type: 'chart', spec: vegaConfig };

                setMessages(prevMessages => {
                    const newMessages = [...prevMessages, chartMessage];
                    console.log('newMessages: ', newMessages)
                    return newMessages;
                });
            }
        }
    };

    const extractResponseError = async (response) => {
        let extractedError = "";

        for (const item of response) {
            if (item.error) {
                extractedError = item.error;
                // setInput("go on");
                // handleSendMessage();
            }
        }
        console.log('extractedError: ', extractedError)
    };

    const extractResponseLookMLJSON = async (response) => {
        for (const item of response) {
            if (item.systemMessage && item.systemMessage.data && item.systemMessage.data.generatedLookerQuery) {
                console.log('extractedLookMLJSON: ', item.systemMessage.data.generatedLookerQuery)
            }
        }
    };

    const handleSendMessage = async () => {
        // if (!accessToken) {
        //     alert('Please Authenticate before sending a message.');
        //     return;
        // }

        if (input.trim() !== '') {
            console.log('input: ', input)
            setIsSummarizing(true);

            const filteredMessages = messages.filter(msg => msg.sender && msg.text);
            const formattedMessages = JSON.stringify(filteredMessages, null, 2);

            const inputWithPreviousMessages = `
                These are the previous messages in our conversation so far:
                ${formattedMessages}
                My next message:
                ${input}
            `;

            console.log('Previous Messages: ', inputWithPreviousMessages)

            const requestBody = agentConfig.type === 'looker' ? {
                project: GCP_PROJECT,
                messages: [
                    {
                        user_message: {
                            text: inputWithPreviousMessages,
                        },
                    },
                ],
                context: {
                    system_instruction: agentConfig.system_instructions,
                    datasource_references: {
                        looker: {
                            explore_references: [
                                {
                                    looker_instance_uri: LOOKER_INSTANCE_URL,
                                    lookml_model: agentConfig.model,
                                    explore: agentConfig.explore,
                                },
                            ],
                            credentials: {
                                oauth: {
                                    secret: {
                                        client_id: LOOKER_CLIENT_ID,
                                        client_secret: LOOKER_CLIENT_SECRET,
                                    },
                                },
                            },
                        },
                    },
                },
            } : agentConfig.type === 'bigquery' ? {
                project: GCP_PROJECT,
                messages: [
                    {
                        user_message: {
                            text: inputWithPreviousMessages,
                        },
                    },
                ],
                context: {
                    system_instruction: agentConfig.system_instructions,
                    datasource_references: {
                        bq: {
                            table_references: [
                                {
                                    project_id: GCP_PROJECT_NAME,
                                    dataset_id: agentConfig.dataset_id,
                                    table_id: agentConfig.table_id,
                                },
                            ],
                        },
                    },
                },
            } : null; // or throw an error, or assign a default, depending on your needs.

            const userMessage = { sender: 'user', text: input };

            setMessages(prevMessages => {
                const newMessages = [...prevMessages, userMessage]; // Add the new user message
                console.log('newMessages: ', newMessages)
                return newMessages;
            });

            setInput('');

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                        // Authorization: `Bearer ${ACCESS_TOKEN}`,
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                console.log('API Response:', data);
                extractResponseError(data);
                extractResponseText(data);
                extractResponseChart(data);
                extractResponseLookMLJSON(data);
                setIsSummarizing(false);
            } catch (error) {
                console.error('Error posting data:', error);
            }
        }
    };


    const MessageContent = ({ message }) => {
        if (message.type === 'chart') {
            try {
                return (
                    <div className="chartContainer">
                        <VegaLite spec={message.spec} />
                    </div>
                );
            } catch (error) {
                console.error('Error rendering VegaLite chart:', error);
                return <div>Error rendering chart: {error.message}</div>;
            }
        }

        return (
            <div>
                {message.text ? (
                    <pre className="preformatted">{message.text}</pre>
                ) : (
                    <div>Empty message content</div>
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="App">
                <h4>{agentConfig.name} 💬🤖</h4>
            </div>
            <div className="chatBotContainer">
                <div
                    className="chatMessages"
                    ref={chatContainerRef}
                >
                    {messages.map((msg, index) => (
                        <div key={index} className="MessageWrapper" style={{ justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                            <div
                                className="MessageContainer"
                                style={{
                                    backgroundColor: msg.type === 'chart' ? '#fff' : (msg.sender === 'user' ? '#1a73e8' : '#f4f4f4'),
                                    color: msg.sender === 'user' ? '#FFFFFF' : 'grey',
                                    borderBottomLeftRadius: msg.sender === 'user' ? '16px' : '0px',
                                    borderBottomRightRadius: msg.sender === 'user' ? '0px' : '16px',
                                }}
                            >
                                <MessageContent message={msg} />
                            </div>
                            {msg.sender === 'user' && userInfo && (
                                <img
                                    src={userInfo.avatar_url}
                                    alt="User avatar"
                                    className="Avatar"
                                />
                            )}
                        </div>
                    ))}
                    {isSummarizing && (
                        <div className="MessageWrapper" style={{ justifyContent: 'flex-start' }}>
                            <div className="MessageContainer" style={{ backgroundColor: '#f4f4f4' }}>
                                <div className="TypingDotsContainer">
                                    <div className="TypingDot" style={{ animationDelay: '0s' }} />
                                    <div className="TypingDot" style={{ animationDelay: '0.2s' }} />
                                    <div className="TypingDot" style={{ animationDelay: '0.4s' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="inputSection">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        className="input"
                        placeholder="Type your message..."
                    />
                    <button
                        onClick={handleSendMessage}
                        className="button"
                    >
                        {'Send'}
                    </button>
                </div>
            </div>
        </div>
    );

}

export default Chatter;