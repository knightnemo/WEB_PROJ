import { API } from 'Plugins/CommonUtils/API'

export enum UserCourseAction {
    GetInteraction = 'GetInteraction',
    EnrollCourse = 'EnrollCourse',
    RateCourse = 'RateCourse',
    FavoriteCourse = 'FavoriteCourse'
}

export class UserCourseMessage extends API {
    userName: string;
    courseId: string;
    action: UserCourseAction;
    rating?: number;

    constructor(
        userName: string,
        courseId: string,
        action: UserCourseAction,
        rating?: number
    ) {
        super();
        this.serviceName = 'Course';
        this.userName = userName;
        this.courseId = courseId;
        this.action = action;
        this.rating = rating;
        console.log(`Creating UserCourseMessage: userName=${userName}, courseId=${courseId}, action=${action}, rating=${rating}`);
    }

    toJSON() {
        const json: any = {
            userName: this.userName,
            courseId: this.courseId,
            action: this.action,
            rating: this.rating
        };

        console.log(`Serializing UserCourseMessage to JSON:`, json);
        return json;
    }
}