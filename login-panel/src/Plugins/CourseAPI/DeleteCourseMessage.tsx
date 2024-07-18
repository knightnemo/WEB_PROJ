import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class DeleteCourseMessage extends CourseMessage {
    courseId: string;

    constructor(courseId: string) {
        super();
        this.courseId = courseId;
    }
}