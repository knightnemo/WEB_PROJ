import React, { useState } from 'react';
import axios, { isAxiosError } from 'axios'
import { API } from 'Plugins/CommonUtils/API'
import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage'
import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage'
import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage'
import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage'
import { AddPatientMessage } from 'Plugins/DoctorAPI/AddPatientMessage'
import { DeletePatientMessage } from 'Plugins/DoctorAPI/DeletePatientMessage'
import { useHistory } from 'react-router';

export function Main(){
    const history=useHistory()
    const sendPostRequest = async (message: API) => {
        try {
            const response = await axios.post(message.getURL(), JSON.stringify(message), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Response status:', response.status);
            console.log('Response body:', response.data);
        } catch (error) {
            if (isAxiosError(error)) {
                // Check if the error has a response and a data property
                if (error.response && error.response.data) {
                    console.error('Error sending request:', error.response.data);
                } else {
                    console.error('Error sending request:', error.message);
                }
            } else {
                console.error('Unexpected error:', error);
            }
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>HTTP Post Requests</h1>
            </header>
            <main>
                <button onClick={() => sendPostRequest(new LoginMessage('aaaa', 'bbbb'))}>
                    Doctor Login aaaa
                </button>
                <button onClick={() => sendPostRequest(new RegisterMessage('aaaa', 'bbbb'))}>
                    Doctor Register aaaa
                </button>
                <button onClick={() => sendPostRequest(new LoginMessage('aaaab', 'bbbb'))}>
                    Doctor Login aaaab
                </button>
                <button onClick={() => sendPostRequest(new PatientLoginMessage('cccc', 'bbbb'))}>
                    Patient Login cccc
                </button>
                <button onClick={() => sendPostRequest(new PatientRegisterMessage('cccc', 'bbbb'))}>
                    Patient Register cccc
                </button>
                <button onClick={() => sendPostRequest(new AddPatientMessage('aaaa', 'cccc'))}>
                    Add Patient
                </button>
                <button onClick={() => sendPostRequest(new DeletePatientMessage('cccc', 'bbbb'))}>
                    Delete Patient
                </button>
                <button onClick={() => history.push("/another")}>
                    jump to another page
                </button>
            </main>
        </div>
    );
};


