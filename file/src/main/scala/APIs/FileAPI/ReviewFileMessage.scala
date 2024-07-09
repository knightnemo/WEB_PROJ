package APIs.FileAPI

case class ReviewFileMessage(fileId: Int, reviewStatus: String) extends FileMessage[String]