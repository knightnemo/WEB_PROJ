package APIs.FileAPI

case class UploadFileMessage(fileName: String, fileContent: Array[Byte]) extends FileMessage[String]