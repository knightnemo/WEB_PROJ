import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from './UserContext';
import { CreateLiveStreamMessage } from 'Plugins/LiveStreamAPI/CreateLiveStreamMessage';
import { AllClassroomsQueryMessage } from 'Plugins/ClassroomAPI/AllClassroomsQueryMessage';
import { CheckClassroomAvailabilityMessage } from 'Plugins/ClassroomAPI/CheckClassroomAvailabilityMessage';
import './PublishLiveStream.css';
import { useHistory } from 'react-router-dom';

interface Classroom {
    id: string;
    name: string;
    capacity: number;
    slot1: string;
    slot2: string;
    slot3: string;
    slot4: string;
    slot5: string;
    slot6: string;
    slot7: string;
    slot8: string;
}

const PublishLiveStream: React.FC = () => {
    const { username } = useUser();
    const history = useHistory();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [liveStreamName, setLiveStreamName] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetchClassrooms();
    }, []);

    const handleBack = () => {
        history.goBack();
    };

    const fetchClassrooms = async () => {
        try {
            const allClassroomsQueryMessage = new AllClassroomsQueryMessage();
            const response = await axios.post(allClassroomsQueryMessage.getURL(), JSON.stringify(allClassroomsQueryMessage), {
                headers: { 'Content-Type': 'application/json' },
            });

            console.log('原始响应:', response.data);

            let parsedData;
            if (typeof response.data === 'string') {
                try {
                    parsedData = JSON.parse(response.data);
                } catch (parseError) {
                    console.error('解析响应数据时出错:', parseError);
                    throw new Error('解析响应数据失败');
                }
            } else {
                parsedData = response.data;
            }

            if (Array.isArray(parsedData)) {
                setClassrooms(parsedData);
            } else {
                console.error('意外的数据格式:', parsedData);
                throw new Error('意外的数据格式');
            }
        } catch (error) {
            console.error('获取教室列表失败:', error);
            setError('获取教室列表失败: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const checkAvailability = async (classroom: Classroom, slotNumber: number): Promise<boolean> => {
        try {
            const message = new CheckClassroomAvailabilityMessage(classroom.name, slotNumber);
            console.log('发送 CheckClassroomAvailabilityMessage:', JSON.stringify({ message }));
            const response = await axios.post(message.getURL(), { message }, {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('CheckClassroomAvailabilityMessage 响应:', response.data);
            return response.data === true;
        } catch (error) {
            console.error('检查教室可用性时出错:', error);
            return false;
        }
    };

    const handlePublish = async () => {
        if (!selectedClassroom || selectedSlot === null || !liveStreamName || !username) {
            setError('请填写所有字段');
            return;
        }

        try {
            const message = new CreateLiveStreamMessage(
                liveStreamName,
                selectedClassroom.name,
                username,
                selectedSlot,
                selectedClassroom.capacity  // 添加容量参数
            );
            console.log('发送 CreateLiveStreamMessage:', JSON.stringify({ message }));
            const response = await axios.post(message.getURL(), { message }, {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('CreateLiveStreamMessage 响应:', response.data);
            if (response.data) {
                alert('直播课程发布成功');
                // 重置表单
                setSelectedClassroom(null);
                setSelectedSlot(null);
                setLiveStreamName('');
            }
        } catch (error) {
            console.error('发布直播课程时出错:', error);
            setError('发布直播课程失败');
        }
    };

    return (
        <div className="publish-live-stream">
            <h2>发布直播课程</h2>
            {error && <p className="error">{error}</p>}
            <select
                value={selectedClassroom ? selectedClassroom.id : ''}
                onChange={(e) => {
                    const classroom = classrooms.find(c => c.id === e.target.value);
                    setSelectedClassroom(classroom || null);
                    setSelectedSlot(null);
                }}
            >
                <option value="">选择教室</option>
                {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                        {classroom.name} (容量: {classroom.capacity})
                    </option>
                ))}
            </select>
            {selectedClassroom && (
                <div className="slot-selection">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((slotNumber) => (
                        <button
                            key={slotNumber}
                            onClick={async () => {
                                const isAvailable = await checkAvailability(selectedClassroom, slotNumber);
                                if (isAvailable) {
                                    setSelectedSlot(slotNumber);
                                    setError('');
                                } else {
                                    setError(`时段 ${slotNumber} 不可用`);
                                }
                            }}
                            disabled={selectedClassroom[`slot${slotNumber}` as keyof Classroom] === '1'}
                            className={selectedSlot === slotNumber ? 'selected' : ''}
                        >
                            时段 {slotNumber}
                        </button>
                    ))}
                </div>
            )}
            <input
                type="text"
                value={liveStreamName}
                onChange={(e) => setLiveStreamName(e.target.value)}
                placeholder="输入直播课程名称"
            />
            <button onClick={handlePublish}>发布直播课程</button>
            <button onClick={handleBack} className="back-button">返回</button>
        </div>
    );
};

export default PublishLiveStream;