package APIs.CourseAPI

case class UpdateCourseMessage(
                                courseId: String,
                                title: Option[String],
                                instructor: Option[String],
                                description: Option[String]
                              ) extends CourseMessage[Boolean]