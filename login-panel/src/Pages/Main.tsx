// import React, { useState } from 'react';
// import axios, { isAxiosError } from 'axios'
// import { API } from 'Plugins/CommonUtils/API'
// import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage'
// import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage'
// import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage'
// import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage'
// import { AddPatientMessage } from 'Plugins/DoctorAPI/AddPatientMessage'
// import { useHistory } from 'react-router';
//
// export function Main(){
//     const history=useHistory()
//     const sendPostRequest = async (message: API) => {
//         try {
//             const response = await axios.post(message.getURL(), JSON.stringify(message), {
//                 headers: { 'Content-Type': 'application/json' },
//             });
//             console.log('Response status:', response.status);
//             console.log('Response body:', response.data);
//         } catch (error) {
//             if (isAxiosError(error)) {
//                 // Check if the error has a response and a data property
//                 if (error.response && error.response.data) {
//                     console.error('Error sending request:', error.response.data);
//                 } else {
//                     console.error('Error sending request:', error.message);
//                 }
//             } else {
//                 console.error('Unexpected error:', error);
//             }
//         }
//     };
//
//     return (
//         <div className="App">
//             <header className="App-header">
//                 <h1>HTTP Post Requests</h1>
//             </header>
//             <main>
//                 <button onClick={() => sendPostRequest(new LoginMessage('aaaa', 'bbbb'))}>
//                     Doctor Login aaaa
//                 </button>
//                 <button onClick={() => sendPostRequest(new RegisterMessage('aaaa', 'bbbb'))}>
//                     Doctor Register aaaa
//                 </button>
//                 <button onClick={() => sendPostRequest(new LoginMessage('aaaab', 'bbbb'))}>
//                     Doctor Login aaaab
//                 </button>
//                 <button onClick={() => sendPostRequest(new PatientLoginMessage('cccc', 'bbbb'))}>
//                     Patient Login cccc
//                 </button>
//                 <button onClick={() => sendPostRequest(new PatientRegisterMessage('cccc', 'bbbb'))}>
//                     Patient Register cccc
//                 </button>
//                 <button onClick={() => sendPostRequest(new AddPatientMessage('aaaa', 'cccc'))}>
//                     Add Patient
//                 </button>
//                 <button onClick={() => history.push("/another")}>
//                     jump to another page
//                 </button>
//             </main>
//         </div>
//     );
// };

import React, { useState, useEffect } from 'react';
import axios, { isAxiosError } from 'axios'
import { API } from 'Plugins/CommonUtils/API'
import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage'
import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage'
import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage'
import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage'
import { AddPatientMessage } from 'Plugins/DoctorAPI/AddPatientMessage'
import { useHistory } from 'react-router-dom';

interface Course {
    id: number;
    title: string;
    instructor: string;
    rating: number;
    reviews: number;
}

export function Main() {
    const history = useHistory();
    const [courses, setCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchCourses = async () => {
            const mockCourses: Course[] = [
                { id: 1, title: "Web开发入门", instructor: "张三", rating: 4.5, reviews: 120 },
                { id: 2, title: "数据科学与机器学习", instructor: "李四", rating: 4.8, reviews: 200 },
                { id: 3, title: "移动应用开发", instructor: "王五", rating: 4.2, reviews: 80 },
            ];
            setCourses(mockCourses);
        };
        fetchCourses();
    }, []);

    const filteredCourses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sendPostRequest = async (message: API) => {
        try {
            const response = await axios.post(message.getURL(), JSON.stringify(message), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Response status:', response.status);
            console.log('Response body:', response.data);
        } catch (error) {
            if (isAxiosError(error)) {
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
        <div>
            <header className="header">
                <h1 className="site-title">课程评价网站</h1>
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="搜索课程..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                        onClick={() => history.push('/auth')}
                        className="auth-button"
                    >
                        注册 / 登录
                    </button>
                </div>
            </header>

            <main>
                <div className="course-grid">
                    {filteredCourses.map((course) => (
                        <div key={course.id} className="course-card">
                            <div className="course-content">
                                <h2 className="course-title">{course.title}</h2>
                                <p className="course-instructor">讲师: {course.instructor}</p>
                                <div className="course-rating">
                                    <span className="star">★</span>
                                    <span>{course.rating.toFixed(1)}</span>
                                    <span>({course.reviews} 评价)</span>
                                </div>
                                <button
                                    onClick={() => history.push(`/course/${course.id}`)}
                                    className="details-button"
                                >
                                    查看详情
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="admin-buttons">
                    <button onClick={() => sendPostRequest(new LoginMessage('aaaa', 'bbbb'))} className="admin-button">
                        管理员登录 (aaaa)
                    </button>
                    <button onClick={() => sendPostRequest(new RegisterMessage('aaaa', 'bbbb'))} className="admin-button">
                        管理员注册 (aaaa)
                    </button>
                    <button onClick={() => sendPostRequest(new PatientLoginMessage('cccc', 'bbbb'))} className="admin-button">
                        用户登录 (cccc)
                    </button>
                    <button onClick={() => sendPostRequest(new PatientRegisterMessage('cccc', 'bbbb'))} className="admin-button">
                        用户注册 (cccc)
                    </button>
                    <button onClick={() => sendPostRequest(new AddPatientMessage('aaaa', 'cccc'))} className="admin-button">
                        添加用户
                    </button>
                    <button onClick={() => history.push("/another")} className="admin-button">
                        跳转到另一个页面
                    </button>
                </div>
            </main>
        </div>
    );
}