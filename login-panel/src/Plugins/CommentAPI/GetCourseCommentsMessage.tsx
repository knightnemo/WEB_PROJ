import { v4 as uuidv4 } from 'uuid';
import { CommentMessage } from 'Plugins/CommentAPI/CommentMessage';

export class GetCourseCommentsMessage extends CommentMessage {
    courseId: string;
    page: number;
    pageSize: number;
    traceID: string;

    constructor(courseId: string, page: number, pageSize: number) {
        super();
        this.courseId = courseId;
        this.page = page;
        this.pageSize = pageSize;
        this.traceID = uuidv4();
    }

    toJSON() {
        return {
            planContext: {
                traceID: this.traceID,
                transactionLevel: 0
            },
            message: {
                courseId: this.courseId,
                page: this.page,
                pageSize: this.pageSize
            }
        };
    }
}
