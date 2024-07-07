import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class UpdateCourseMessage extends CourseMessage {
    id: string;
    title?: string;
    instructor?: string;
    description?: string;
    rating?: number;
    reviews?: number;
    imageUrl?: string;  // 新增字段

    constructor(
        id: string,
        title?: string,
        instructor?: string,
        description?: string,
        rating?: number,
        reviews?: number,
        imageUrl?: string  // 新增参数
    ) {
        super();
        this.id = id;
        this.title = title;
        this.instructor = instructor;
        this.description = description;
        this.rating = rating;
        this.reviews = reviews;
        this.imageUrl = imageUrl;  // 初始化新字段
    }
}