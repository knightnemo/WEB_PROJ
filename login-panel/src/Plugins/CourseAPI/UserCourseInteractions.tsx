import { API } from 'Plugins/CommonUtils/API';
import axios from 'axios';

export interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl?: string;
    resourceUrl: string;
    durationMinutes: number;
    difficultyLevel: string;
    category: string;
    subcategory?: string;
    language: string;
    prerequisites: string[];
    interested_users: string[];
}

export interface User {
    username: string;
}

export class GetUserFavoriteCoursesMessage extends API {
    constructor(public userName: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { userName: this.userName };
    }
}

export class GetUserRatedCoursesMessage extends API {
    constructor(public userName: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { userName: this.userName };
    }
}

export class GetUserEnrolledCoursesMessage extends API {
    constructor(public userName: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { userName: this.userName };
    }
}

export class GetCourseEnrolledUsersMessage extends API {
    constructor(public courseId: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { courseId: this.courseId };
    }
}

export class GetCourseRatingUsersMessage extends API {
    constructor(public courseId: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { courseId: this.courseId };
    }
}

export class GetCourseFavoritedUsersMessage extends API {
    constructor(public courseId: string) {
        super();
        this.serviceName = "Course";
    }

    toJSON() {
        return { courseId: this.courseId };
    }
}

const parseScalaList = (input: string): any[] => {
    // 移除 "List(" 前缀和结尾的 ")"
    const content = input.slice(5, -1).trim();

    // 如果内容为空，返回空数组
    if (content === '') {
        return [];
    }

    // 使用正则表达式匹配每个 JSON 对象
    const jsonObjects = content.match(/\{[^{}]*\}/g);

    if (!jsonObjects) {
        throw new Error('No valid JSON objects found in the input string');
    }

    // 解析每个 JSON 对象
    return jsonObjects.map(jsonStr => JSON.parse(jsonStr));
};

export const getUserFavoriteCourses = async (userName: string): Promise<Course[]> => {
    const message = new GetUserFavoriteCoursesMessage(userName);
    const response = await axios.post(message.getURL(), message.toJSON());
    return parseScalaList(response.data);
};

export const getUserRatedCourses = async (userName: string): Promise<[Course, number][]> => {
    const message = new GetUserRatedCoursesMessage(userName);
    const response = await axios.post(message.getURL(), message.toJSON());
    return parseScalaList(response.data).map(([course, rating]: [any, number]) => [course as Course, rating]);
};

export const getUserEnrolledCourses = async (userName: string): Promise<Course[]> => {
    const message = new GetUserEnrolledCoursesMessage(userName);
    const response = await axios.post(message.getURL(), message.toJSON());
    return parseScalaList(response.data);
};

export const getCourseEnrolledUsers = async (courseId: string): Promise<User[]> => {
    const message = new GetCourseEnrolledUsersMessage(courseId);
    const response = await axios.post(message.getURL(), message.toJSON());
    return parseScalaList(response.data);
};

export const getCourseRatingUsers = async (courseId: string): Promise<[User, number][]> => {
    const message = new GetCourseRatingUsersMessage(courseId);
    const response = await axios.post(message.getURL(), message.toJSON());
    return parseScalaList(response.data);
};

export const getCourseFavoritedUsers = async (courseId: string): Promise<User[]> => {
    const message = new GetCourseFavoritedUsersMessage(courseId);
    const response = await axios.post(message.getURL(), message.toJSON());
    return parseScalaList(response.data);
};




export const calculateAverageRating = (ratings: number[]): string => {
    // Filter out ratings that are not zero
    const nonZeroRatings = ratings.filter(rating => rating !== 0);

    if (nonZeroRatings.length === 0) return "0.0";

    // Calculate sum of non-zero ratings
    const sum = nonZeroRatings.reduce((a, b) => a + b, 0);

    // Calculate average and return as a string with one decimal place
    const average = sum / nonZeroRatings.length;
    return average.toFixed(1);
};
