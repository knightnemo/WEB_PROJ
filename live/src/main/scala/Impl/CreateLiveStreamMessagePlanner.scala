package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.CreateLiveStreamMessage
import io.circe.generic.auto._
import io.circe.syntax._

import java.util.UUID

case class CreateLiveStreamMessagePlanner(
                                           message: CreateLiveStreamMessage,
                                           override val planContext: PlanContext
                                         ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    val id = UUID.randomUUID().toString
    val CreateLiveStreamMessage(name, classroom, teacher, slot) = message

    val writeMessage = WriteDBMessage(
      s"""INSERT INTO ${schemaName}.live_streams
         |(id, name, classroom, teacher, slot)
         |VALUES (?, ?, ?, ?, ?)""".stripMargin,
      List(
        SqlParameter("String", id),
        SqlParameter("String", name),
        SqlParameter("String", classroom),
        SqlParameter("String", teacher),
        SqlParameter("Int", slot.toString)
      )
    )

    writeMessage.asJson.as[WriteDBMessage].fold(
      error => IO.raiseError(new Exception(s"Failed to encode WriteDBMessage: ${error.getMessage}")),
      encodedMessage => encodedMessage.send.attempt.flatMap {
        case Right(_) => IO.pure(s"Live stream created successfully with name: $name")
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to create live stream: ${error.getMessage}"))
      }
    )
  }