package APIs.CourseAPI

case class DeleteCourseMessage(courseId: String) extends CourseMessage[Boolean]