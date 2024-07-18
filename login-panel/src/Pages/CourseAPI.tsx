import axios from 'axios';
import { API } from 'Plugins/CommonUtils/API';

export interface CourseData {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl: string;
    resourceUrl: string;
    durationMinutes: number;
    difficultyLevel: string;
    category: string;
    subcategory?: string;
    language: string;
    prerequisites: string[];
    learningObjectives: string[];
}
abstract class CourseMessage extends API {
    override serviceName: string = "Course"
}

class AddCourseMessage extends CourseMessage {
    constructor(
        public title: string,
        public instructor: string,
        public description: string,
        public rating: string,
        public imageUrl: string,
        public resourceUrl: string,
        public durationMinutes: number,
        public difficultyLevel: string,
        public category: string,
        public language: string,
        public prerequisites: string[],
        public learningObjectives: string[],
        public subcategory?: string
    ) {
        super();
    }
}

class UpdateCourseMessage extends CourseMessage {
    constructor(
        public id: string,
        public title?: string,
        public instructor?: string,
        public description?: string,
        public rating?: string,
        public imageUrl?: string,
        public resourceUrl?: string,
        public durationMinutes?: number,
        public difficultyLevel?: string,
        public category?: string,
        public subcategory?: string,
        public language?: string,
        public prerequisites?: string[],
        public learningObjectives?: string[]
    ) {
        super();
    }
}

export const addCourse = async (
    title: string,
    instructor: string,
    description: string,
    rating: string,
    imageUrl: string,
    resourceUrl: string,
    durationMinutes: number,
    difficultyLevel: string,
    category: string,
    language: string,
    prerequisites: string[],
    learningObjectives: string[],
    subcategory?: string
): Promise<string> => {
    const response = await sendPostRequest(new AddCourseMessage(
        title, instructor, description, rating, imageUrl, resourceUrl,
        durationMinutes, difficultyLevel, category, language,
        prerequisites, learningObjectives, subcategory
    ));
    return response;
};

class CourseQueryMessage extends CourseMessage {
    constructor(public courseId: string) {
        super();
    }
}

class DeleteCourseMessage extends CourseMessage {
    constructor(public courseId: string) {
        super();
    }
}

export const updateCourse = async (
    id: string,
    title?: string,
    instructor?: string,
    description?: string,
    rating?: string,
    imageUrl?: string,
    resourceUrl?: string,
    durationMinutes?: number,
    difficultyLevel?: string,
    category?: string,
    subcategory?: string,
    language?: string,
    prerequisites?: string[],
    learningObjectives?: string[]
): Promise<boolean> => {
    const response = await sendPostRequest(new UpdateCourseMessage(
        id, title, instructor, description, rating, imageUrl,
        resourceUrl, durationMinutes, difficultyLevel, category,
        subcategory, language, prerequisites, learningObjectives
    ));
    return response;
};

const sendPostRequest = async (apiMessage: API): Promise<any> => {
    try {
        const response = await axios.post(apiMessage.getURL(), JSON.stringify(apiMessage), {
            headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Request failed:', error.message);
            console.error('Status:', error.response?.status);
            console.error('Data:', error.response?.data);
            console.error('Headers:', error.response?.headers);
        } else {
            console.error('An unexpected error occurred:', error);
        }
        throw error;
    }
};

class AllCoursesQueryMessage extends CourseMessage {
    constructor() {
        super();
    }
}

export const fetchAllCourses = async (): Promise<CourseData[]> => {
    try {
        const message = new AllCoursesQueryMessage();
        const response = await sendPostRequest(message);
        return response;
    } catch (error) {
        console.error('Error in fetchAllCourses:', error);
        throw error;
    }
};

export const fetchCourse = async (id: string): Promise<CourseData | null> => {
    try {
        const response = await sendPostRequest(new CourseQueryMessage(id));
        return response;
    } catch (error) {
        console.error('Error in fetchCourse:', error);
        throw error;
    }
};

export const deleteCourse = async (id: string): Promise<boolean> => {
    const response = await sendPostRequest(new DeleteCourseMessage(id));
    return response;
};