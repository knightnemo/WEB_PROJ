package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.ReadDBRowsMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.DoctorAPI.{DoctorQueryMessage, DoctorInfo}
import cats.effect.IO
import io.circe.generic.auto._
import io.circe.parser._

case class DoctorQueryMessagePlanner(doctorName: String, override val planContext: PlanContext) extends Planner[DoctorInfo]:
  override def plan(using PlanContext): IO[DoctorInfo] = {
    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT user_name, bio, followers, following, review_count,
         |       slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8
         |FROM ${schemaName}.doctors
         |WHERE user_name = ?
      """.stripMargin,
      List(SqlParameter("String", doctorName))
    )

    readMessage.send.flatMap { rows =>
      rows.headOption match {
        case Some(row) =>
          IO.fromEither(for {
            userName <- row.hcursor.get[String]("user_name")
            bio <- row.hcursor.get[String]("bio")
            followers <- row.hcursor.get[Int]("followers")
            following <- row.hcursor.get[Int]("following")
            reviewCount <- row.hcursor.get[Int]("review_count")
            slot1 <- row.hcursor.get[String]("slot1")
            slot2 <- row.hcursor.get[String]("slot2")
            slot3 <- row.hcursor.get[String]("slot3")
            slot4 <- row.hcursor.get[String]("slot4")
            slot5 <- row.hcursor.get[String]("slot5")
            slot6 <- row.hcursor.get[String]("slot6")
            slot7 <- row.hcursor.get[String]("slot7")
            slot8 <- row.hcursor.get[String]("slot8")
          } yield DoctorInfo(userName, bio, followers, following, reviewCount, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8))
        case None =>
          IO.raiseError(new Exception("Doctor not found"))
      }
    }
  }