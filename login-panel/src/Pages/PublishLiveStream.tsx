import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from './UserContext';
import { CreateLiveStreamMessage } from 'Plugins/LiveStreamAPI/CreateLiveStreamMessage';
import { AllClassroomsQueryMessage } from 'Plugins/ClassroomAPI/AllClassroomsQueryMessage';
import { CheckClassroomAvailabilityMessage } from 'Plugins/ClassroomAPI/CheckClassroomAvailabilityMessage';
import './PublishLiveStream.css';

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
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [liveStreamName, setLiveStreamName] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetchClassrooms();
    }, []);

    const fetchClassrooms = async () => {
        try {
            const allClassroomsQueryMessage = new AllClassroomsQueryMessage();
            const response = await axios.post(allClassroomsQueryMessage.getURL(), JSON.stringify(allClassroomsQueryMessage), {
                headers: { 'Content-Type': 'application/json' },
            });

            console.log('Raw response:', response.data);

            let parsedData;
            if (typeof response.data === 'string') {
                try {
                    parsedData = JSON.parse(response.data);
                } catch (parseError) {
                    console.error('Error parsing response data:', parseError);
                    throw new Error('Failed to parse response data');
                }
            } else {
                parsedData = response.data;
            }

            if (Array.isArray(parsedData)) {
                setClassrooms(parsedData);
            } else {
                console.error('Unexpected data format:', parsedData);
                throw new Error('Unexpected data format');
            }
        } catch (error) {
            console.error('Error fetching classrooms:', error);
            setError('Failed to fetch classrooms: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const checkAvailability = async (classroom: Classroom, slotNumber: number): Promise<boolean> => {
        try {
            const message = new CheckClassroomAvailabilityMessage(classroom.name, slotNumber);
            console.log('Sending CheckClassroomAvailabilityMessage:', JSON.stringify({ message }));
            const response = await axios.post(message.getURL(), { message }, {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('CheckClassroomAvailabilityMessage response:', response.data);
            // 修改这里：如果返回值为 true，说明槽位的值是 '0'，即可用
            return response.data === true;
        } catch (error) {
            console.error('Error checking classroom availability:', error);
            return false;
        }
    };

    const handlePublish = async () => {
        if (!selectedClassroom || selectedSlot === null || !liveStreamName || !username) {
            setError('Please fill all fields');
            return;
        }

        try {
            const message = new CreateLiveStreamMessage(
                liveStreamName,
                selectedClassroom.name,
                username,
                selectedSlot
            );
            console.log('Sending CreateLiveStreamMessage:', JSON.stringify({ message }));
            const response = await axios.post(message.getURL(), { message }, {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('CreateLiveStreamMessage response:', response.data);
            if (response.data) {
                alert('Live stream published successfully');
                // Reset form
                setSelectedClassroom(null);
                setSelectedSlot(null);
                setLiveStreamName('');
            }
        } catch (error) {
            console.error('Error publishing live stream:', error);
            setError('Failed to publish live stream');
        }
    };

    return (
        <div className="publish-live-stream">
            <h2>Publish Live Stream</h2>
            {error && <p className="error">{error}</p>}
            <select
                value={selectedClassroom ? selectedClassroom.id : ''}
                onChange={(e) => {
                    const classroom = classrooms.find(c => c.id === e.target.value);
                    setSelectedClassroom(classroom || null);
                    setSelectedSlot(null);
                }}
            >
                <option value="">Select a classroom</option>
                {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                        {classroom.name} (Capacity: {classroom.capacity})
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
                                    setError(`Slot ${slotNumber} is not available`);
                                }
                            }}
                            disabled={selectedClassroom[`slot${slotNumber}` as keyof Classroom] === '1'}
                            className={selectedSlot === slotNumber ? 'selected' : ''}
                        >
                            Slot {slotNumber}
                        </button>
                    ))}
                </div>
            )}
            <input
                type="text"
                value={liveStreamName}
                onChange={(e) => setLiveStreamName(e.target.value)}
                placeholder="Enter live stream name"
            />
            <button onClick={handlePublish}>Publish Live Stream</button>
        </div>
    );
};

export default PublishLiveStream;