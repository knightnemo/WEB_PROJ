import { API } from 'Plugins/CommonUtils/API';
import axios from 'axios';

export interface CourseChange {
    courseId: string;
    courseTitle: string; // 新增字段
    changeType: string;
}

class RecordCourseChangeMessage extends API {
    constructor(public courseId: string, public changeType: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { courseId: this.courseId, changeType: this.changeType };
    }
}

class GetUserCourseChangesMessage extends API {
    constructor(public userName: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { userName: this.userName };
    }
}

export const recordCourseChange = async (courseId: string, changeType: string): Promise<string> => {
    const message = new RecordCourseChangeMessage(courseId, changeType);
    const response = await axios.post(message.getURL(), message.toJSON());
    return response.data;
};

export const getUserCourseChanges = async (userName: string): Promise<CourseChange[]> => {
    const message = new GetUserCourseChangesMessage(userName);
    console.log('Sending request:', message.toJSON());
    try {
        const response = await axios.post(message.getURL(), message.toJSON());
        console.log('Received response:', response.data);
        return JSON.parse(response.data);
    } catch (error) {
        console.error('Error in getUserCourseChanges:', error);
        if (axios.isAxiosError(error)) {
            console.error('Response data:', error.response?.data);
            console.error('Response status:', error.response?.status);
        }
        throw error;
    }
};