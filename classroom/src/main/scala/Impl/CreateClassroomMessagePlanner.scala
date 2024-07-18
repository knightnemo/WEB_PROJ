package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.ClassroomAPI.CreateClassroomMessage
import io.circe.generic.auto._
import io.circe.syntax._

import java.util.UUID

case class CreateClassroomMessagePlanner(
                                          message: CreateClassroomMessage,
                                          override val planContext: PlanContext
                                        ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    val id = UUID.randomUUID().toString
    val CreateClassroomMessage(name, capacity, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8) = message

    val writeMessage = WriteDBMessage(
      s"""INSERT INTO ${schemaName}.classrooms
         |(id, name, capacity, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8)
         |VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""".stripMargin,
      List(
        SqlParameter("String", id),
        SqlParameter("String", name),
        SqlParameter("Int", capacity.toString),
        SqlParameter("String", slot1),
        SqlParameter("String", slot2),
        SqlParameter("String", slot3),
        SqlParameter("String", slot4),
        SqlParameter("String", slot5),
        SqlParameter("String", slot6),
        SqlParameter("String", slot7),
        SqlParameter("String", slot8)
      )
    )

    writeMessage.asJson.as[WriteDBMessage].fold(
      error => IO.raiseError(new Exception(s"Failed to encode WriteDBMessage: ${error.getMessage}")),
      encodedMessage => encodedMessage.send.attempt.flatMap {
        case Right(_) => IO.pure(s"Classroom created successfully with ID: $id and name: $name")
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to create classroom: ${error.getMessage}"))
      }
    )
  }