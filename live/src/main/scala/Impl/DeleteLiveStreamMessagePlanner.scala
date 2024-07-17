package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.DeleteLiveStreamMessage
import io.circe.generic.auto._
import io.circe.syntax._

case class DeleteLiveStreamMessagePlanner(
                                           message: DeleteLiveStreamMessage,
                                           override val planContext: PlanContext
                                         ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    val DeleteLiveStreamMessage(id) = message

    val writeMessage = WriteDBMessage(
      s"DELETE FROM ${schemaName}.live_streams WHERE id = ?",
      List(SqlParameter("String", id))
    )

    writeMessage.asJson.as[WriteDBMessage].fold(
      error => IO.raiseError(new Exception(s"Failed to encode WriteDBMessage: ${error.getMessage}")),
      encodedMessage => encodedMessage.send.attempt.flatMap {
        case Right(_) => IO.pure(s"Live stream with ID: $id deleted successfully")
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to delete live stream: ${error.getMessage}"))
      }
    )
  }