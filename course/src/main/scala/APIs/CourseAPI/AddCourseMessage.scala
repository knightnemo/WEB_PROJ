package APIs.CourseAPI

case class AddCourseMessage(
                             id: String,
                             title: String,
                             instructor: String,
                             description: String,
                             rating: String,
                             image_url: String,
                             resource_url: String,
                             duration_minutes: Int,
                             difficulty_level: String,
                             category: String,
                             subcategory: Option[String],
                             language: String,
                             prerequisites: List[String],
                             interested_users: List[String]
                           )