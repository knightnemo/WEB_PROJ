package APIs.CourseAPI

case class AddCourseMessage(
                             title: String,
                             instructor: String,
                             description: String
                           ) extends CourseMessage[String]