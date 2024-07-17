package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.ReadDBRowsMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.ClassroomAPI.CheckClassroomAvailabilityMessage
import cats.effect.IO
import io.circe.generic.auto._
import io.circe.parser._

case class CheckClassroomAvailabilityMessagePlanner(
                                                     message: CheckClassroomAvailabilityMessage,
                                                     override val planContext: PlanContext
                                                   ) extends Planner[Boolean]:

  override def plan(using PlanContext): IO[Boolean] = {
    val CheckClassroomAvailabilityMessage(name, slotNumber) = message

    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT slot${slotNumber}
         |FROM ${schemaName}.classrooms
         |WHERE name = ?
      """.stripMargin,
      List(
        SqlParameter("String", name)
      )
    )

    readMessage.send.flatMap { rows =>
      rows.headOption match {
        case Some(row) =>
          IO.fromEither(
            row.hcursor.get[String](s"slot$slotNumber").map(_ == "0")
          )
        case None =>
          IO.raiseError(new Exception(s"Classroom with name: $name not found"))
      }
    }
  }