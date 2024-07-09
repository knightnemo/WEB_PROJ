package APIs.FileAPI

case class DeleteFileMessage(fileId: Int) extends FileMessage[String]